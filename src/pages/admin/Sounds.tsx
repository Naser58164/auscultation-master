import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Upload, Trash2, Play, Pause, Search, Loader2, Music } from 'lucide-react';
import { Sound, SoundSystem } from '@/types/database';

export default function AdminSounds() {
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSystem, setFilterSystem] = useState<SoundSystem | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [system, setSystem] = useState<SoundSystem>('lung');
  const [soundCode, setSoundCode] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchSounds();
  }, []);

  const fetchSounds = async () => {
    try {
      const { data, error } = await supabase
        .from('sound_library')
        .select('*')
        .order('system')
        .order('name');

      if (error) throw error;
      setSounds((data as Sound[]) || []);
    } catch (error) {
      console.error('Error fetching sounds:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch sounds',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!name || !soundCode || !system) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      let fileUrl = null;
      let filePath = null;

      if (file) {
        const fileExt = file.name.split('.').pop();
        filePath = `${soundCode}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('audio-files')
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('audio-files')
          .getPublicUrl(filePath);

        fileUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from('sound_library')
        .insert({
          name,
          description,
          system,
          sound_code: soundCode,
          file_path: filePath,
          file_url: fileUrl,
          created_by: user?.id,
        });

      if (error) throw error;

      toast({
        title: 'Sound Added',
        description: 'Sound has been added to the library',
      });

      // Reset form
      setName('');
      setDescription('');
      setSoundCode('');
      setSystem('lung');
      setFile(null);
      setDialogOpen(false);
      fetchSounds();
    } catch (error: any) {
      console.error('Error adding sound:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add sound',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (sound: Sound) => {
    if (!confirm(`Delete "${sound.name}"?`)) return;

    try {
      if (sound.file_path) {
        await supabase.storage.from('audio-files').remove([sound.file_path]);
      }

      const { error } = await supabase
        .from('sound_library')
        .delete()
        .eq('id', sound.id);

      if (error) throw error;

      toast({
        title: 'Sound Deleted',
        description: 'Sound has been removed from the library',
      });

      fetchSounds();
    } catch (error) {
      console.error('Error deleting sound:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete sound',
        variant: 'destructive',
      });
    }
  };

  const togglePlay = (sound: Sound) => {
    if (!sound.file_url) return;

    if (playingId === sound.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(sound.file_url);
      audioRef.current.play();
      audioRef.current.onended = () => setPlayingId(null);
      setPlayingId(sound.id);
    }
  };

  const filteredSounds = sounds.filter((sound) => {
    const matchesSearch = sound.name.toLowerCase().includes(search.toLowerCase()) ||
      sound.sound_code.toLowerCase().includes(search.toLowerCase());
    const matchesSystem = filterSystem === 'all' || sound.system === filterSystem;
    return matchesSearch && matchesSystem;
  });

  const getSystemBadgeClass = (sys: SoundSystem) => {
    switch (sys) {
      case 'lung':
        return 'system-badge-lung';
      case 'heart':
        return 'system-badge-heart';
      case 'bowel':
        return 'system-badge-bowel';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Sound Library</h1>
            <p className="text-muted-foreground">
              Manage audio files for auscultation training
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Sound
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Sound</DialogTitle>
                <DialogDescription>
                  Upload an audio file to the sound library
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Normal Vesicular"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sound Code *</Label>
                  <Input
                    value={soundCode}
                    onChange={(e) => setSoundCode(e.target.value.toUpperCase())}
                    placeholder="e.g., LUNG_NORMAL"
                  />
                  <p className="text-xs text-muted-foreground">
                    Unique identifier for Arduino protocol
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>System *</Label>
                  <Select value={system} onValueChange={(v) => setSystem(v as SoundSystem)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lung">Lung</SelectItem>
                      <SelectItem value="heart">Heart</SelectItem>
                      <SelectItem value="bowel">Bowel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the sound..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Audio File (optional)</Label>
                  <Input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </div>
                <Button onClick={handleUpload} disabled={uploading} className="w-full">
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Add Sound
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Music className="h-5 w-5" />
                  Audio Library
                </CardTitle>
                <CardDescription>
                  {sounds.length} sounds available
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterSystem} onValueChange={(v) => setFilterSystem(v as SoundSystem | 'all')}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Systems</SelectItem>
                    <SelectItem value="lung">Lung</SelectItem>
                    <SelectItem value="heart">Heart</SelectItem>
                    <SelectItem value="bowel">Bowel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSounds.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {sounds.length === 0 ? 'No sounds in library yet' : 'No sounds match your search'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>System</TableHead>
                    <TableHead>Audio</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSounds.map((sound) => (
                    <TableRow key={sound.id}>
                      <TableCell className="font-medium">{sound.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {sound.sound_code}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge className={getSystemBadgeClass(sound.system as SoundSystem)}>
                          {sound.system}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sound.file_url ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => togglePlay(sound)}
                          >
                            {playingId === sound.id ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">No file</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(sound)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
