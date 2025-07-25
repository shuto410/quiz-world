import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                '**/*.config.ts',
                '**/*.config.mjs',
                '**/*.d.ts',
                'src/app/layout.tsx',
                'src/app/page.tsx',
                'src/types/',
                'src/server/',
                'src/lib/utils.ts',
                '.next/',
                'public/',
                'node_modules/',
            ],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
}); 