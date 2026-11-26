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
 * Resolves a representative's registered account email from their unique username.
 */
export async function resolveEmailFromUsername(username: string): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const cleanUsername = username.trim().toLowerCase();

  try {
    // 1. Try secure RPC function if available
    const { data: rpcEmail, error: rpcError } = await supabase.rpc(
      'get_representative_email_by_username',
      { p_username: cleanUsername }
    );

    if (!rpcError && rpcEmail) {
      return rpcEmail as string;
    }

    // 2. Fallback to direct query on public.representatives
    const { data: rep, error: repError } = await supabase
      .from('representatives')
      .select('email')
      .ilike('username', cleanUsername)
      .maybeSingle();

    if (!repError && rep?.email) {
      return rep.email;
    }
  } catch (err) {
    console.warn('Username resolution error:', err);
  }

  return null;
}

/**
 * Signs in a class representative using their unique username and password.
 * Internally resolves username to the authorized Supabase account email,
 * ensuring passwords are never stored in plain text or in browser storage.
 */
export async function signInWithUsername(username: string, password: string) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured. Please verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }

  const cleanUsername = username.trim();
  if (!cleanUsername) {
    throw new Error('Please enter your representative username.');
  }

  if (!password) {
    throw new Error('Please enter your password.');
  }

  // 1. Lookup registered email associated with this username
  const resolvedEmail = await resolveEmailFromUsername(cleanUsername);

  if (!resolvedEmail) {
    // Return generic security error to prevent username harvesting
    throw new Error('Invalid username or password. Please verify your representative credentials.');
  }

  // 2. Authenticate securely via Supabase Auth email & password
  const { data, error } = await supabase.auth.signInWithPassword({
    email: resolvedEmail,
    password,
  });

  if (error) {
    // Return sanitized credential error message
    throw new Error('Invalid username or password. Please verify your representative credentials.');
  }

  return data;
}

/**
 * Initiates a secure password reset email for a representative's registered recovery email.
 */
export async function requestPasswordReset(usernameOrEmail: string): Promise<{ success: boolean; maskedEmail: string }> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const cleanInput = usernameOrEmail.trim().toLowerCase();
  if (!cleanInput) {
    throw new Error('Please enter your representative username or email.');
  }

  let targetEmail: string | null = null;
  let maskedEmail = '';

  // 1. Try recovery info RPC
  try {
    const { data: rpcInfo, error: rpcError } = await supabase.rpc(
      'get_representative_recovery_info',
      { p_username: cleanInput }
    );

    if (!rpcError && rpcInfo && rpcInfo.found) {
      targetEmail = rpcInfo.email;
      maskedEmail = rpcInfo.maskedEmail;
    }
  } catch (err) {
    console.warn('Error querying get_representative_recovery_info:', err);
  }

  // 2. If not found via RPC, check if input is directly an authorized email or username
  if (!targetEmail) {
    const { data: rep } = await supabase
      .from('representatives')
      .select('email')
      .or(`username.ilike.${cleanInput},email.ilike.${cleanInput}`)
      .maybeSingle();

    if (rep?.email) {
      targetEmail = rep.email;
      const [u, d] = rep.email.split('@');
      maskedEmail = `${u.slice(0, 2)}***@${d}`;
    }
  }

  if (!targetEmail) {
    throw new Error('No registered class representative found matching this username.');
  }

  // 3. Send password recovery email via Supabase Auth
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
    redirectTo: `${window.location.origin}/login?action=reset`,
  });

  if (resetError) {
    throw new Error(resetError.message || 'Failed to send password recovery email.');
  }

  return { success: true, maskedEmail: maskedEmail || targetEmail };
}

/**
 * Updates representative's password when authenticated or after recovery.
 */
export async function updatePassword(newPassword: string) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
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
 * Validates whether the logged-in user belongs to an authorized representative,
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
          'Access restricted: This account is not an authorized class representative for this college portal.',
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
        error: 'Representative account found, but not currently assigned to any active class.',
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
      username: repData.username,
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
        username?: string;
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
          username: rep.username,
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
        username: 'pending.rep',
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
