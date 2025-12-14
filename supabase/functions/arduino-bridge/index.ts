import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sound system codes for Arduino protocol
const SYSTEM_CODES: Record<string, string> = {
  lung: 'L',
  heart: 'H',
  bowel: 'B'
};

// Location codes for Arduino protocol - mapped to anatomical positions
const LOCATION_CODES: Record<string, string> = {
  // Lung locations
  'right-upper-anterior': 'RUA',
  'right-middle-anterior': 'RMA',
  'right-lower-anterior': 'RLA',
  'left-upper-anterior': 'LUA',
  'left-lower-anterior': 'LLA',
  'right-upper-posterior': 'RUP',
  'right-middle-posterior': 'RMP',
  'right-lower-posterior': 'RLP',
  'left-upper-posterior': 'LUP',
  'left-middle-posterior': 'LMP',
  'left-lower-posterior': 'LLP',
  // Heart locations
  'aortic': 'AOR',
  'pulmonic': 'PUL',
  'erbs-point': 'ERB',
  'tricuspid': 'TRI',
  'mitral': 'MIT',
  // Bowel locations
  'ruq': 'RUQ',
  'luq': 'LUQ',
  'rlq': 'RLQ',
  'llq': 'LLQ',
  'periumbilical': 'PER'
};

interface ArduinoCommand {
  action: 'play' | 'stop' | 'volume' | 'status';
  system?: string;
  soundCode?: string;
  location?: string;
  volume?: number;
}

interface FormattedCommand {
  raw: string;
  bytes: number[];
  checksum: number;
  description: string;
}

function calculateChecksum(data: string): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data.charCodeAt(i);
  }
  return sum % 256;
}

function formatCommand(command: ArduinoCommand): FormattedCommand {
  let raw = '';
  let description = '';

  switch (command.action) {
    case 'play':
      // Format: <STX>P:<SYSTEM>:<SOUND>:<LOCATION>:<VOLUME><ETX><CHECKSUM>
      const systemCode = SYSTEM_CODES[command.system || ''] || 'U';
      const soundCode = command.soundCode?.toUpperCase() || 'UNK';
      const locationCode = LOCATION_CODES[command.location || ''] || 'UNK';
      const volume = Math.min(10, Math.max(0, command.volume || 5));
      
      raw = `P:${systemCode}:${soundCode}:${locationCode}:${volume}`;
      description = `Play ${command.system} sound "${soundCode}" at ${command.location} with volume ${volume}`;
      break;

    case 'stop':
      raw = 'S';
      description = 'Stop all playback';
      break;

    case 'volume':
      const vol = Math.min(10, Math.max(0, command.volume || 5));
      raw = `V:${vol}`;
      description = `Set volume to ${vol}`;
      break;

    case 'status':
      raw = 'Q';
      description = 'Query device status';
      break;

    default:
      raw = 'N';
      description = 'No operation';
  }

  const checksum = calculateChecksum(raw);
  const STX = 0x02; // Start of text
  const ETX = 0x03; // End of text

  // Build byte array for serial transmission
  const bytes: number[] = [STX];
  for (let i = 0; i < raw.length; i++) {
    bytes.push(raw.charCodeAt(i));
  }
  bytes.push(ETX);
  bytes.push(checksum);

  return {
    raw,
    bytes,
    checksum,
    description
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const command: ArduinoCommand = await req.json();
    
    console.log('Received command:', JSON.stringify(command));

    // Validate required fields
    if (!command.action) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (command.action === 'play') {
      if (!command.system || !command.soundCode || !command.location) {
        return new Response(
          JSON.stringify({ error: 'Play action requires system, soundCode, and location' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const formatted = formatCommand(command);
    
    console.log('Formatted command:', JSON.stringify(formatted));

    // Return formatted command for client-side serial transmission
    // In production, this could directly interface with hardware via WebSerial API
    // or a local bridge service
    return new Response(
      JSON.stringify({
        success: true,
        command: formatted,
        timestamp: new Date().toISOString(),
        // Include hex representation for debugging
        hex: formatted.bytes.map(b => b.toString(16).padStart(2, '0')).join(' ')
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing command:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to process command', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
