import { ApiInfo, Config, HailerApi, HailerError, Settings, Signal, User, Workflow } from '@hailer/app-sdk';
import { enableMapSet, produce } from 'immer';
import { create } from 'zustand';

enableMapSet();

type AppState = ReturnType<typeof appState>;

type StoreSet = (
  partial: AppState |
    Partial<AppState> |
    ((state: AppState) => AppState |
      Partial<AppState>), replace?: false
) => void;
type StoreGet = () => AppState;

type EventHandler = (data: { [key: string]: string | number }) => void;

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

  emit(event: string, data: { [key: string]: string | number }) {
    if (!this.events[event]) return;

    this.events[event].forEach(listener => listener(data));
  }
}

const appState = (set: StoreSet, get: StoreGet) => ({
  api: {
    setHailer: (hailer: HailerApi) => {
      set(produce<AppState>(state => {
        state.hailer = hailer;
      }));
    },
    init: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const self = window as unknown as any;
      const api = get().api;

      if (self.hailerApiInstance) {
        // Using window instance to prevent hotload creating new instances on each change.
      } else {
        self.hailerApiInstance = new HailerApi({
          connected: async () => set(produce<AppState>(state => { state.inside = true; state.outside = false; api.onReady(); state.info = hailer?.info();  })),
          outside: async () => set(produce<AppState>(state => { state.inside = false; state.outside = true; api.onReady(); })),
          config: (config: Config) => set(produce<AppState>(state => { state.config = config; })),
          settings: (settings: Settings) => set(produce<AppState>(state => { state.settings = settings })),
          signals: () => {},
        });
      }

      const hailer: HailerApi = self.hailerApiInstance;

      if (!hailer || !api) {
        console.log('Init failed, no hailer or api.');
        return;
      }

      set(produce<AppState>(state => {
        state.hailer = hailer;
      }));

      // Attach signal listener, and pass them on as event (EventEmitter)
      hailer.options.signals = (signal: Signal) => {
        get().event?.emit(signal.name, signal.data);
      }
    },
    /** Called when loaded inside hailer, and connection  */
    onReady: async () => {
      const hailer = get().hailer;
      const api = get().api;

      if (!hailer || !api) {
        console.log('onReady failed, no hailer or api.');
        return;
      }

      if (get().outside) {
        // HailerApi has indicated that the app has been loaded outside a Hailer frame, or failed to connect
        api.setReady();
        return;
      }

      // Read the permission map, to determine if we are an admin or not
      const permission = await hailer.permission.map();

      const isAdmin = permission[hailer.info().workspaceId || '']?.workspace.isAdmin;

      api.setIsAdmin(isAdmin);

      // Read the current Hailer user and save it in the state
      api.user.setCurrent(await hailer.user.current());

      // Read the users from Hailer
      api.user.set(await hailer.user.list().catch(error => { console.error('Error listing workflows', error as HailerError); return []; }));

      // Read the Workflows and Datasets from Hailer
      const workflowList = await hailer.workflow.list().catch(error => { console.error('Error listing workflows', error as HailerError); return []; });

      api.app.workflows.set(workflowList.sort((a, b) => a.name.localeCompare(b.name)));

      api.setReady();
    },
    setIsAdmin: (isAdmin = true) => {
      set(produce<AppState>(state => {
        state.isAdmin = isAdmin;
      }));
    },
    setAdminMode: (adminMode = true) => {
      set(produce<AppState>(state => {
        state.adminMode = adminMode;
      }));
    },
    setReady: (ready = true) => {
      set(produce<AppState>(state => {
        state.ready = ready;
      }));
    },
    app: {
      workflows: {
        set: (workflows: Workflow[]) => {
          set(produce<AppState>(state => {
            state.app.workflows = workflows;
          }));
        }
      }
    },
    user: {
      set: (users: User[]) => {
        set(produce<AppState>(state => {
          state.user.map = Object.fromEntries(users.map(user => [user._id, user]));
        }));
      },
      setCurrent: (user: User) => {
        set(produce<AppState>(state => {
          state.user.current = user;
        }));
      }
    },
  },
  ready: false,
  inside: null as boolean | null,
  outside: null as boolean | null,
  hailer: undefined as HailerApi | undefined,
  /** Used to pass Hailer events globally in the app. */
  event: new EventEmitter(),
  config: undefined as Config | undefined,
  settings: undefined as Settings | undefined,
  info: undefined as ApiInfo | undefined,
  isAdmin: undefined as boolean | undefined,
  adminMode: undefined as boolean | undefined,
  app: {
    workflows: [] as Workflow[],
  },
  user: {
    map: {} as { [userId: string]: User },
    current: undefined as User | undefined,
  },
});

/**
 * Manges the app state, and has Hailer support integrated. You may extend this state for your custom app, or create whatever state management you wish.
 */
export const useApp = create(appState);
