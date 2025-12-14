import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// WebSerial API type definitions
interface SerialOptions {
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'odd';
}

interface SerialPort {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  getInfo(): { usbVendorId?: number; usbProductId?: number };
}

interface Serial {
  requestPort(): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

declare global {
  interface Navigator {
    serial?: Serial;
  }
}

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

interface ArduinoResponse {
  success: boolean;
  command: FormattedCommand;
  timestamp: string;
  hex: string;
}

interface DeviceStatus {
  connected: boolean;
  portName: string | null;
  lastResponse: string | null;
  lastCommandTime: Date | null;
}

const DEFAULT_SERIAL_OPTIONS: SerialOptions = {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none'
};

export function useArduinoSerial() {
  const [isSupported, setIsSupported] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({
    connected: false,
    portName: null,
    lastResponse: null,
    lastCommandTime: null
  });
  const [logs, setLogs] = useState<string[]>([]);

  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);

  // Check WebSerial support on mount
  useEffect(() => {
    setIsSupported('serial' in navigator);
  }, []);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-99), `[${timestamp}] ${message}`]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Connect to serial device
  const connect = useCallback(async (options: Partial<SerialOptions> = {}) => {
    if (!isSupported) {
      toast.error('WebSerial is not supported in this browser');
      return false;
    }

    if (isConnected) {
      toast.info('Already connected to a device');
      return true;
    }

    setIsConnecting(true);

    try {
      // Request port selection from user
      const port = await navigator.serial.requestPort();
      
      // Open port with merged options
      const serialOptions = { ...DEFAULT_SERIAL_OPTIONS, ...options };
      await port.open(serialOptions);

      portRef.current = port;

      // Set up writer
      if (port.writable) {
        writerRef.current = port.writable.getWriter();
      }

      // Set up reader for incoming data
      if (port.readable) {
        readerRef.current = port.readable.getReader();
        readLoop();
      }

      setIsConnected(true);
      setDeviceStatus(prev => ({
        ...prev,
        connected: true,
        portName: 'Arduino Device'
      }));

      addLog('Connected to serial device');
      toast.success('Connected to Arduino');
      return true;

    } catch (error) {
      console.error('Failed to connect:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Connection failed: ${message}`);
      
      if (message.includes('No port selected')) {
        // User cancelled the dialog
      } else {
        toast.error(`Failed to connect: ${message}`);
      }
      return false;

    } finally {
      setIsConnecting(false);
    }
  }, [isSupported, isConnected, addLog]);

  // Read loop for incoming serial data
  const readLoop = useCallback(async () => {
    const reader = readerRef.current;
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete messages (terminated by newline or ETX)
        const lines = buffer.split(/[\n\x03]/);
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            addLog(`← ${line.trim()}`);
            setDeviceStatus(prev => ({
              ...prev,
              lastResponse: line.trim()
            }));
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'NetworkError') {
        console.error('Read error:', error);
        addLog(`Read error: ${error.message}`);
      }
    }
  }, [addLog]);

  // Disconnect from serial device
  const disconnect = useCallback(async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current.releaseLock();
        readerRef.current = null;
      }

      if (writerRef.current) {
        await writerRef.current.close();
        writerRef.current = null;
      }

      if (portRef.current) {
        await portRef.current.close();
        portRef.current = null;
      }

      setIsConnected(false);
      setDeviceStatus({
        connected: false,
        portName: null,
        lastResponse: null,
        lastCommandTime: null
      });

      addLog('Disconnected from serial device');
      toast.success('Disconnected from Arduino');

    } catch (error) {
      console.error('Disconnect error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Disconnect error: ${message}`);
    }
  }, [addLog]);

  // Send raw bytes to serial port
  const sendBytes = useCallback(async (bytes: number[]): Promise<boolean> => {
    const writer = writerRef.current;
    if (!writer || !isConnected) {
      addLog('Cannot send: not connected');
      return false;
    }

    try {
      const data = new Uint8Array(bytes);
      await writer.write(data);
      
      const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join(' ');
      addLog(`→ ${hex}`);
      
      setDeviceStatus(prev => ({
        ...prev,
        lastCommandTime: new Date()
      }));

      return true;
    } catch (error) {
      console.error('Send error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Send error: ${message}`);
      return false;
    }
  }, [isConnected, addLog]);

  // Send command through edge function and to serial port
  const sendCommand = useCallback(async (command: ArduinoCommand): Promise<boolean> => {
    try {
      addLog(`Formatting command: ${command.action}`);

      // Call edge function to format the command
      const { data, error } = await supabase.functions.invoke<ArduinoResponse>('arduino-bridge', {
        body: command
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success) {
        throw new Error('Failed to format command');
      }

      addLog(`Command: ${data.command.description}`);

      // If connected to hardware, send the bytes
      if (isConnected) {
        const sent = await sendBytes(data.command.bytes);
        if (!sent) {
          throw new Error('Failed to send to device');
        }
        toast.success(data.command.description);
      } else {
        // Log command for debugging when not connected
        addLog(`[Simulated] Would send: ${data.hex}`);
        toast.info(`Command ready: ${data.command.description}`);
      }

      return true;

    } catch (error) {
      console.error('Command error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Command error: ${message}`);
      toast.error(`Command failed: ${message}`);
      return false;
    }
  }, [isConnected, addLog, sendBytes]);

  // Convenience methods for common commands
  const playSound = useCallback((
    system: string,
    soundCode: string,
    location: string,
    volume: number = 5
  ) => {
    return sendCommand({
      action: 'play',
      system,
      soundCode,
      location,
      volume
    });
  }, [sendCommand]);

  const stopSound = useCallback(() => {
    return sendCommand({ action: 'stop' });
  }, [sendCommand]);

  const setVolume = useCallback((volume: number) => {
    return sendCommand({ action: 'volume', volume });
  }, [sendCommand]);

  const queryStatus = useCallback(() => {
    return sendCommand({ action: 'status' });
  }, [sendCommand]);

  return {
    // State
    isSupported,
    isConnected,
    isConnecting,
    deviceStatus,
    logs,

    // Connection
    connect,
    disconnect,

    // Commands
    sendCommand,
    playSound,
    stopSound,
    setVolume,
    queryStatus,

    // Utilities
    sendBytes,
    clearLogs
  };
}
