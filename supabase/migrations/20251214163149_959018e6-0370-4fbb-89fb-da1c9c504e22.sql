-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'examiner', 'examinee');

-- Create enum for sound systems
CREATE TYPE public.sound_system AS ENUM ('lung', 'heart', 'bowel');

-- Create enum for session status
CREATE TYPE public.session_status AS ENUM ('pending', 'active', 'paused', 'completed');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Create sound_library table
CREATE TABLE public.sound_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  system sound_system NOT NULL,
  sound_code TEXT NOT NULL UNIQUE,
  file_path TEXT,
  file_url TEXT,
  duration_seconds INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sessions table
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  session_code TEXT NOT NULL UNIQUE,
  examiner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status session_status DEFAULT 'pending',
  current_sound_id UUID REFERENCES public.sound_library(id),
  current_location TEXT,
  current_volume INTEGER DEFAULT 5,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create session_participants table
CREATE TABLE public.session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (session_id, user_id)
);

-- Create responses table
CREATE TABLE public.responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  expected_sound_id UUID REFERENCES public.sound_library(id),
  expected_location TEXT,
  submitted_sound_id UUID REFERENCES public.sound_library(id),
  submitted_location TEXT,
  is_sound_correct BOOLEAN,
  is_location_correct BOOLEAN,
  response_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sound_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's highest role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'admin' THEN 1 
      WHEN 'examiner' THEN 2 
      WHEN 'examinee' THEN 3 
    END
  LIMIT 1
$$;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Sound library policies
CREATE POLICY "Authenticated users can view sounds"
  ON public.sound_library FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage sounds"
  ON public.sound_library FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Sessions policies
CREATE POLICY "Examiners can view own sessions"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (examiner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Participants can view joined sessions"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_participants
      WHERE session_id = id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view session by code for joining"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (status IN ('pending', 'active'));

CREATE POLICY "Examiners can create sessions"
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    examiner_id = auth.uid() AND 
    (public.has_role(auth.uid(), 'examiner') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Examiners can update own sessions"
  ON public.sessions FOR UPDATE
  TO authenticated
  USING (examiner_id = auth.uid());

CREATE POLICY "Examiners can delete own sessions"
  ON public.sessions FOR DELETE
  TO authenticated
  USING (examiner_id = auth.uid());

-- Session participants policies
CREATE POLICY "Users can view participants of joined sessions"
  ON public.session_participants FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE id = session_id AND examiner_id = auth.uid()
    )
  );

CREATE POLICY "Users can join sessions"
  ON public.session_participants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave sessions"
  ON public.session_participants FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Responses policies
CREATE POLICY "Examiners can view responses for their sessions"
  ON public.responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE id = session_id AND examiner_id = auth.uid()
    ) OR
    participant_id = auth.uid()
  );

CREATE POLICY "Participants can insert responses"
  ON public.responses FOR INSERT
  TO authenticated
  WITH CHECK (participant_id = auth.uid());

-- Trigger function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- Default role is examinee
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'examinee');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create update triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sound_library_updated_at
  BEFORE UPDATE ON public.sound_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for sessions and responses
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.responses;

-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-files', 'audio-files', true);

-- Storage policies
CREATE POLICY "Public can view audio files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio-files');

CREATE POLICY "Admins can upload audio files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'audio-files' AND
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can update audio files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'audio-files' AND
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can delete audio files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'audio-files' AND
    public.has_role(auth.uid(), 'admin')
  );