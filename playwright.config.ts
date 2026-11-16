import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'tests/mobile',timeout:60000,use:{baseURL:'http://127.0.0.1:4173',viewport:{width:390,height:844},launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},webServer:{command:'npm run preview -- --port 4173',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI},reporter:'list'});
