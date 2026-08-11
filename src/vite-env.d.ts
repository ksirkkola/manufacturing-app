/// <reference types="vite/client" />

import { HailerApi } from '@hailer/app-sdk';

declare global {
    interface Window {
        hailerApiInstance: HailerApi;
    }
}