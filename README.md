# QK Lego Builder

A browser-based 3D LEGO builder powered by Three.js and React. Build virtual LEGO creations with accurate brick shapes from the official LDraw parts library.

## Features

- **3D Building**: Place, move, rotate, clone, and delete LEGO bricks in a 3D scene
- **Accurate Brick Shapes**: 300+ brick types rendered using the LDraw parts library with real 3D geometry (slopes, curves, cones, round bricks, etc.)
- **3D Brick Previews**: Thumbnail previews of each brick rendered in real-time using Three.js
- **Color Palette**: Solid, transparent, and metallic LEGO colors
- **Save/Load Scenes**: Save your creations with custom names and load them later
- **Multi-user Support**: Real-time collaboration via WebSocket - multiple users can build together
- **Keyboard Shortcuts**: Quick mode switching (B=Build, P=Paint, D=Delete, M=Move, C=Clone, X=Explore)
- **Modern UI**: Glassmorphism-styled interface with LeoCAD-inspired brick picker

## Tech Stack

- **Frontend**: React 18, Three.js, Redux, Vite
- **Backend**: Node.js, Express, WebSocket
- **3D Models**: LDraw parts library (23,000+ parts)
- **Data**: Rebrickable LEGO database for part metadata

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/skasriel/qk-lego.git
   cd qk-lego
   ```

2. **Install dependencies**
   ```bash
   cd client && npm install && cd ..
   ```

3. **Download the LDraw parts library**

   Download the complete LDraw library from [library.ldraw.org](https://library.ldraw.org/library/updates/complete.zip) and extract it to `server/ldraw/`:
   ```bash
   curl -L -o /tmp/ldraw.zip https://library.ldraw.org/library/updates/complete.zip
   unzip /tmp/ldraw.zip -d server/
   ```

4. **Start the backend server**
   ```bash
   cd server && node server.js
   ```

5. **Start the frontend dev server** (in a separate terminal)
   ```bash
   cd client && npm start
   ```

6. **Open** [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

```bash
cd client && npm run build
```

The built files will be in `client/build/`, served automatically by the Express server.

## Usage

### Modes

| Mode | Shortcut | Description |
|------|----------|-------------|
| Build | B | Place new bricks |
| Paint | P | Change brick colors |
| Delete | D | Remove bricks |
| Move | M | Reposition bricks |
| Clone | C | Duplicate bricks |
| Explore | X | Orbit camera freely |

### Building

1. Select a brick type from the bottom panel (organized by category)
2. Choose a color from the right sidebar
3. Hover over the scene to preview placement
4. Click to place the brick
5. Use R to rotate before placing

### Saving/Loading

- Click **Save Scene** in the right sidebar to save your creation
- Click **Load Scene** to browse and load saved creations
- Press ESC to close dialogs

## Development

### Linting

```bash
cd client
npm run lint        # Check for errors
npm run lint:fix    # Auto-fix issues
npm run format      # Format with Prettier
```

### Project Structure

```
qk-lego/
  client/               # React frontend
    src/
      components/       # UI components (Topbar, Sidebar, BrickPicker, etc.)
      engine/           # Three.js scene, brick rendering, LDraw loader
      actions/          # Redux actions
      reducer/          # Redux reducers
    vite.config.js      # Vite configuration with proxy settings
  server/
    server.js           # Express + WebSocket server
    ldraw/              # LDraw parts library (not committed, see setup)
```

## Credits

- [LDraw](https://www.ldraw.org/) - LEGO parts library
- [Rebrickable](https://rebrickable.com/) - LEGO parts database
- [Three.js](https://threejs.org/) - 3D rendering engine

## License

MIT
