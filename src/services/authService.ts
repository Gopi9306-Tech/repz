import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ClassProfile, Representative, RepSlot } from '../types';

export interface RepAuthResult {
  authorized: boolean;
  representative: Representative | null;
  coRepresentative: Representative | null;
  classProfile: ClassProfile | null;
  error?: string;
}

/**
 * Initiates Google OAuth Sign-in via Supabase Auth.
 */
export async function signInWithGoogle() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured yet. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Signs out from Supabase Auth session.
 */
export async function signOutFromSupabase() {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Error signing out from Supabase:', error);
  }
}

/**
 * Validates whether the logged-in email belongs to an authorized representative,
 * fetches their assigned class and Co-Representative using RLS.
 */
export async function fetchRepresentativeClassData(
  userEmail: string,
  authUserId?: string
): Promise<RepAuthResult> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      authorized: false,
      representative: null,
      coRepresentative: null,
      classProfile: null,
      error: 'Supabase client is not configured.',
    };
  }

  try {
    // 1. Fetch representative record matching email or auth_user_id
    const { data: repData, error: repError } = await supabase
      .from('representatives')
      .select('*')
      .or(`email.ilike.${userEmail}${authUserId ? `,auth_user_id.eq.${authUserId}` : ''}`)
      .single();

    if (repError || !repData) {
      return {
        authorized: false,
        representative: null,
        coRepresentative: null,
        classProfile: null,
        error:
          'Access restricted: Your Google account email is not an authorized class representative for this college portal.',
      };
    }

    // 2. Link auth_user_id if not already linked
    if (authUserId && repData.auth_user_id !== authUserId) {
      await supabase
        .from('representatives')
        .update({ auth_user_id: authUserId })
        .eq('id', repData.id);
    }

    // 3. Find class_representative junction entry for this representative
    const { data: classRepLink, error: classRepError } = await supabase
      .from('class_representatives')
      .select('class_id, slot')
      .eq('representative_id', repData.id)
      .single();

    if (classRepError || !classRepLink) {
      return {
        authorized: false,
        representative: null,
        coRepresentative: null,
        classProfile: null,
        error: 'Representative found, but not currently assigned to any active class.',
      };
    }

    const assignedClassId = classRepLink.class_id;
    const currentSlot: RepSlot = classRepLink.slot;

    // 4. Fetch the assigned Class (secured by RLS)
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('id', assignedClassId)
      .single();

    if (classError || !classData) {
      return {
        authorized: false,
        representative: null,
        coRepresentative: null,
        classProfile: null,
        error: 'Unable to retrieve assigned class details.',
      };
    }

    // 5. Fetch all representatives assigned to this shared class (maximum 2)
    const { data: allClassReps, error: allRepsError } = await supabase
      .from('class_representatives')
      .select(`
        slot,
        representative:representatives (*)
      `)
      .eq('class_id', assignedClassId);

    if (allRepsError || !allClassReps) {
      return {
        authorized: false,
        representative: null,
        coRepresentative: null,
        classProfile: null,
        error: 'Failed to load class representatives roster.',
      };
    }

    // Build representative objects
    const currentRepObj: Representative = {
      id: repData.id,
      fullName: repData.full_name,
      rollNumber: repData.roll_number,
      email: repData.email,
      phone: repData.phone || '',
      slot: currentSlot,
      avatarInitials: getInitials(repData.full_name),
      avatarUrl: repData.avatar_url,
      lastActive: 'Active now',
      isOnline: true,
      authUserId: repData.auth_user_id,
    };

    // Find Co-Rep
    let coRepObj: Representative | null = null;
    for (const item of allClassReps) {
      const rep = item.representative as unknown as {
        id: string;
        full_name: string;
        roll_number: string;
        email: string;
        phone?: string;
        avatar_url?: string;
        auth_user_id?: string;
      };
      if (rep && rep.id !== repData.id) {
        coRepObj = {
          id: rep.id,
          fullName: rep.full_name,
          rollNumber: rep.roll_number,
          email: rep.email,
          phone: rep.phone || '',
          slot: item.slot as RepSlot,
          avatarInitials: getInitials(rep.full_name),
          avatarUrl: rep.avatar_url,
          lastActive: 'Connected',
          isOnline: true,
          authUserId: rep.auth_user_id,
        };
        break;
      }
    }

    // Fallback co-rep placeholder if only 1 rep has registered yet
    if (!coRepObj) {
      const otherSlot: RepSlot = currentSlot === 'Primary Rep' ? 'Co-Rep' : 'Primary Rep';
      coRepObj = {
        id: 'pending-corep',
        fullName: 'Pending Co-Rep',
        rollNumber: 'Unassigned',
        email: 'pending@college.edu',
        phone: '',
        slot: otherSlot,
        avatarInitials: 'CR',
        lastActive: 'Awaiting pair',
        isOnline: false,
      };
    }

    const repsTuple: [Representative, Representative] =
      currentSlot === 'Primary Rep'
        ? [currentRepObj, coRepObj]
        : [coRepObj, currentRepObj];

    const classProfile: ClassProfile = {
      id: classData.id,
      classCode: classData.class_code,
      department: classData.department,
      semester: classData.semester,
      section: classData.section,
      academicYear: classData.academic_year,
      totalStudents: classData.total_students,
      classJoinCode: classData.class_join_code,
      representatives: repsTuple,
    };

    return {
      authorized: true,
      representative: currentRepObj,
      coRepresentative: coRepObj,
      classProfile,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown authorization error';
    return {
      authorized: false,
      representative: null,
      coRepresentative: null,
      classProfile: null,
      error: message,
    };
  }
}

function getInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'CR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
