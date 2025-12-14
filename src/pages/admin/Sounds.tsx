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
import { Plus, Upload, Trash2, Play, Pause, Search, Loader2, Music, Pencil, FileAudio, RefreshCw } from 'lucide-react';
import { Sound, SoundSystem } from '@/types/database';

export default function AdminSounds() {
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSystem, setFilterSystem] = useState<SoundSystem | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editingSound, setEditingSound] = useState<Sound | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [system, setSystem] = useState<SoundSystem>('lung');
  const [soundCode, setSoundCode] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | ''>('');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  const resetForm = () => {
    setName('');
    setDescription('');
    setSoundCode('');
    setSystem('lung');
    setFile(null);
    setDurationSeconds('');
    setEditingSound(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openEditDialog = (sound: Sound) => {
    setEditingSound(sound);
    setName(sound.name);
    setDescription(sound.description || '');
    setSoundCode(sound.sound_code);
    setSystem(sound.system as SoundSystem);
    setDurationSeconds(sound.duration_seconds || '');
    setFile(null);
    setDialogOpen(true);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
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
      let fileUrl = editingSound?.file_url || null;
      let filePath = editingSound?.file_path || null;

      if (file) {
        const fileExt = file.name.split('.').pop();
        const newFilePath = `${system}/${soundCode.toLowerCase()}.${fileExt}`;

        // Delete old file if exists and path is different
        if (editingSound?.file_path && editingSound.file_path !== newFilePath) {
          await supabase.storage.from('audio-files').remove([editingSound.file_path]);
        }

        const { error: uploadError } = await supabase.storage
          .from('audio-files')
          .upload(newFilePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('audio-files')
          .getPublicUrl(newFilePath);

        fileUrl = urlData.publicUrl;
        filePath = newFilePath;
      }

      const soundData = {
        name,
        description: description || null,
        system,
        sound_code: soundCode,
        file_path: filePath,
        file_url: fileUrl,
        duration_seconds: durationSeconds || null,
        created_by: user?.id,
      };

      if (editingSound) {
        const { error } = await supabase
          .from('sound_library')
          .update(soundData)
          .eq('id', editingSound.id);

        if (error) throw error;

        toast({
          title: 'Sound Updated',
          description: 'Sound has been updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('sound_library')
          .insert(soundData);

        if (error) throw error;

        toast({
          title: 'Sound Added',
          description: 'Sound has been added to the library',
        });
      }

      resetForm();
      setDialogOpen(false);
      fetchSounds();
    } catch (error: any) {
      console.error('Error saving sound:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save sound',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleReplaceFile = async (sound: Sound) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const newFile = target.files?.[0];
      if (!newFile) return;

      setUploading(true);
      try {
        const fileExt = newFile.name.split('.').pop();
        const newFilePath = `${sound.system}/${sound.sound_code.toLowerCase()}.${fileExt}`;

        // Delete old file if exists
        if (sound.file_path) {
          await supabase.storage.from('audio-files').remove([sound.file_path]);
        }

        const { error: uploadError } = await supabase.storage
          .from('audio-files')
          .upload(newFilePath, newFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('audio-files')
          .getPublicUrl(newFilePath);

        await supabase
          .from('sound_library')
          .update({ file_path: newFilePath, file_url: urlData.publicUrl })
          .eq('id', sound.id);

        toast({ title: 'File Replaced', description: 'Audio file updated successfully' });
        fetchSounds();
      } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } finally {
        setUploading(false);
      }
    };
    input.click();
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
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Sound
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingSound ? 'Edit Sound' : 'Add New Sound'}</DialogTitle>
                <DialogDescription>
                  {editingSound ? 'Update sound details and optionally replace the audio file' : 'Upload an audio file to the sound library'}
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
                    onChange={(e) => setSoundCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                    placeholder="e.g., LUNG_VESICULAR"
                    disabled={!!editingSound}
                  />
                  <p className="text-xs text-muted-foreground">
                    Unique identifier (cannot be changed after creation)
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Duration (seconds)</Label>
                    <Input
                      type="number"
                      value={durationSeconds}
                      onChange={(e) => setDurationSeconds(e.target.value ? parseInt(e.target.value) : '')}
                      placeholder="10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Audio File {editingSound ? '(replace)' : ''}</Label>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </div>
                </div>
                {editingSound?.file_url && !file && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                    <FileAudio className="h-4 w-4" />
                    <span className="truncate flex-1">Current file: {editingSound.file_path}</span>
                  </div>
                )}
                <Button onClick={handleUpload} disabled={uploading} className="w-full">
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {editingSound ? 'Save Changes' : 'Add Sound'}
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
                    <TableHead>Duration</TableHead>
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
                        {sound.duration_seconds ? `${sound.duration_seconds}s` : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {sound.file_url ? (
                            <>
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
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReplaceFile(sound)}
                                title="Replace file"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReplaceFile(sound)}
                            >
                              <Upload className="h-4 w-4 mr-1" />
                              Upload
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(sound)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(sound)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
