@echo off
if not exist .env copy .env.example .env
npm install
npm start
pause
