# Miscrits Hub

Miscrits Hub is a competitive arena toolkit consisting of tools like Team Builder, Damage Calculator, PVP Teams, Spawns, Miscripedia, and min-max calculators for the game Miscrits.

## Tech Stack
This project is built using **TypeScript** and **Bun**.

## How to Run Locally

### Prerequisites
You will need [Bun](https://bun.sh/) installed on your machine.

### Installation
Open a terminal in the project root directory and run the following command to install dependencies:
```bash
bun install
```

### Development Server
To spin up a fast development server with hot-reloading:
```bash
bun run dev
```
The application will be available at `http://localhost:3000` (or whichever port Bun outputs).

### Production Build
To create a minified, production-ready build:
```bash
bun run build
```
This will output the compiled application into a `dist/` directory, which can be easily deployed to any static host.
