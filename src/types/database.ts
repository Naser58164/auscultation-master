export type AppRole = 'admin' | 'examiner' | 'examinee';
export type SoundSystem = 'lung' | 'heart' | 'bowel';
export type SessionStatus = 'pending' | 'active' | 'paused' | 'completed';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Sound {
  id: string;
  name: string;
  description: string | null;
  system: SoundSystem;
  sound_code: string;
  file_path: string | null;
  file_url: string | null;
  duration_seconds: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  name: string;
  session_code: string;
  examiner_id: string;
  status: SessionStatus;
  current_sound_id: string | null;
  current_location: string | null;
  current_volume: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  joined_at: string;
}

export interface Response {
  id: string;
  session_id: string;
  participant_id: string;
  expected_sound_id: string | null;
  expected_location: string | null;
  submitted_sound_id: string | null;
  submitted_location: string | null;
  is_sound_correct: boolean | null;
  is_location_correct: boolean | null;
  response_time_ms: number | null;
  created_at: string;
}

// Anatomical locations
export interface AnatomicalLocation {
  id: string;
  name: string;
  system: SoundSystem;
  x: number;
  y: number;
}

export const LUNG_LOCATIONS: AnatomicalLocation[] = [
  { id: 'L1', name: 'Right Upper Anterior', system: 'lung', x: 35, y: 20 },
  { id: 'L2', name: 'Left Upper Anterior', system: 'lung', x: 65, y: 20 },
  { id: 'L3', name: 'Right Middle Anterior', system: 'lung', x: 32, y: 35 },
  { id: 'L4', name: 'Left Middle Anterior', system: 'lung', x: 68, y: 35 },
  { id: 'L5', name: 'Right Lower Anterior', system: 'lung', x: 30, y: 50 },
  { id: 'L6', name: 'Left Lower Anterior', system: 'lung', x: 70, y: 50 },
  { id: 'L7', name: 'Right Upper Posterior', system: 'lung', x: 35, y: 65 },
  { id: 'L8', name: 'Left Upper Posterior', system: 'lung', x: 65, y: 65 },
  { id: 'L9', name: 'Right Lower Posterior', system: 'lung', x: 35, y: 80 },
];

export const HEART_LOCATIONS: AnatomicalLocation[] = [
  { id: 'H1', name: 'Aortic Area', system: 'heart', x: 42, y: 22 },
  { id: 'H2', name: 'Pulmonic Area', system: 'heart', x: 58, y: 22 },
  { id: 'H3', name: "Erb's Point", system: 'heart', x: 45, y: 32 },
  { id: 'H4', name: 'Tricuspid Area', system: 'heart', x: 48, y: 42 },
  { id: 'H5', name: 'Mitral Area', system: 'heart', x: 55, y: 48 },
];

export const BOWEL_LOCATIONS: AnatomicalLocation[] = [
  { id: 'B1', name: 'Right Upper Quadrant', system: 'bowel', x: 35, y: 58 },
  { id: 'B2', name: 'Left Upper Quadrant', system: 'bowel', x: 65, y: 58 },
  { id: 'B3', name: 'Right Lower Quadrant', system: 'bowel', x: 35, y: 75 },
  { id: 'B4', name: 'Left Lower Quadrant', system: 'bowel', x: 65, y: 75 },
];

export const ALL_LOCATIONS = [...LUNG_LOCATIONS, ...HEART_LOCATIONS, ...BOWEL_LOCATIONS];

// Sound categories
export const LUNG_SOUNDS = [
  { code: 'LUNG_NORMAL', name: 'Normal Vesicular' },
  { code: 'LUNG_CRACKLES', name: 'Crackles (Rales)' },
  { code: 'LUNG_WHEEZES', name: 'Wheezes' },
  { code: 'LUNG_RHONCHI', name: 'Rhonchi' },
  { code: 'LUNG_STRIDOR', name: 'Stridor' },
  { code: 'LUNG_PLEURAL_RUB', name: 'Pleural Friction Rub' },
];

export const HEART_SOUNDS = [
  { code: 'HEART_NORMAL', name: 'Normal S1/S2' },
  { code: 'HEART_S3', name: 'S3 Gallop' },
  { code: 'HEART_S4', name: 'S4 Gallop' },
  { code: 'HEART_SYSTOLIC_MURMUR', name: 'Systolic Murmur' },
  { code: 'HEART_DIASTOLIC_MURMUR', name: 'Diastolic Murmur' },
  { code: 'HEART_PERICARDIAL_RUB', name: 'Pericardial Friction Rub' },
];

export const BOWEL_SOUNDS = [
  { code: 'BOWEL_NORMAL', name: 'Normal Bowel Sounds' },
  { code: 'BOWEL_HYPERACTIVE', name: 'Hyperactive' },
  { code: 'BOWEL_HYPOACTIVE', name: 'Hypoactive' },
  { code: 'BOWEL_ABSENT', name: 'Absent' },
  { code: 'BOWEL_BORBORYGMI', name: 'Borborygmi' },
];

export const ALL_SOUNDS = [...LUNG_SOUNDS, ...HEART_SOUNDS, ...BOWEL_SOUNDS];
