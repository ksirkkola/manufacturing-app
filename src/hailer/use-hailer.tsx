import { HailerApi, Config, Settings, Signal, ApiInfo } from '@hailer/app-sdk';
import { useEffect, useState } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventHandler = (data: any) => void;

export class EventEmitter {
  events: { [event: string]: EventHandler[] } = {};

  on(event: string, listener: EventHandler) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event: string, listenerToRemove: EventHandler) {
    if (!this.events[event]) return;

    this.events[event] = this.events[event].filter(listener => listener !== listenerToRemove);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(event: string, data: any) {
    if (!this.events[event]) return;

    this.events[event].forEach(listener => listener(data));
  }
}

const useHailer = () => {
  const [info, setInfo] = useState<ApiInfo | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [inside, setInside] = useState(false);
  const [event] = useState(new EventEmitter());

  useEffect(() => {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const self = window as unknown as any;

    if (self.hailerApiInstance) {
      // Using window instance to prevent hotload creating new instances on each change.
      return;
    }

    self.hailerApiInstance = new HailerApi({
      connected: async () => {
        if (!self.hailerApiInstance) {
          return;
        }
        setInside(true);
      },
      outside: async () => {
        setInside(false);
      },
      config: (config: Config) => {
        setConfig(config);

        if (self.hailerApiInstance) {
          setInfo(self.hailerApiInstance.info())
        }
      },
      settings: (settings: Settings) => setSettings(settings),
      signals: (signal: Signal) => {
        console.log('signal from hailer:', signal);
        event.emit(signal.name, signal.data);
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    inside,
    info,
    config,
    settings,
    event,
    hailer: window?.hailerApiInstance as HailerApi,
  }
}

export default useHailer;
