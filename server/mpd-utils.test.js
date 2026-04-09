const fs = require('fs');
const path = require('path');

// Import the functions to test
const { bricksToMPD, mpdToBricks } = require('./mpd-utils');

describe('MPD Format Tests', () => {
  test('bricksToMPD creates valid MPD format', () => {
    const testBricks = [
      {
        uuid: 'test-1',
        position: { x: 100, y: 50, z: 200 },
        color: '#FF0000',
        colorType: 'solid',
        brickID: '3001',
        angle: 0,
      },
      {
        uuid: 'test-2',
        position: { x: 200, y: 50, z: 300 },
        color: '#00FF00',
        colorType: 'solid',
        brickID: '3002',
        angle: 1.5708,
      },
    ];

    const mpd = bricksToMPD(testBricks, 'Test Model');
    
    // Check header
    expect(mpd).toContain('0 Test Model');
    expect(mpd).toContain('0 Name: Test Model.ldr');
    
    // Check that bricks are present (lines starting with "1 ")
    const brickLines = mpd.split('\n').filter(line => line.startsWith('1 '));
    expect(brickLines.length).toBe(2);
    
    // Check first brick format: 1 color x y z matrix...
    expect(brickLines[0]).toMatch(/^1\s+\d+\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+/);
  });

  test('mpdToBricks parses MPD format correctly', () => {
    const mpdContent = `0 Test Model
0 Name: Test.ldr
0 Author: Test
1 0 100 -50 200 1 0 0 0 1 0 0 0 1 3001.dat
1 4 200 -50 300 0 0 -1 0 1 0 1 0 0 3002.dat
`;

    const bricks = mpdToBricks(mpdContent);
    
    expect(bricks).toHaveLength(2);
    expect(bricks[0].brickID).toBe('3001');
    expect(bricks[0].position.x).toBeCloseTo(40, 0); // 100 / 2.5
    expect(bricks[0].position.y).toBeCloseTo(20, 0); // -(-50) / 2.5
    expect(bricks[1].brickID).toBe('3002');
  });

  test('Round-trip: bricks -> MPD -> bricks preserves data', () => {
    const original = [
      {
        uuid: 'test-1',
        position: { x: 100, y: 50, z: 200 },
        color: '#FF0000',
        colorType: 'solid',
        brickID: '3001',
        angle: 0,
      },
    ];

    const mpd = bricksToMPD(original, 'Test');
    const loaded = mpdToBricks(mpd);
    
    expect(loaded).toHaveLength(1);
    expect(loaded[0].brickID).toBe('3001');
    expect(loaded[0].position.x).toBeCloseTo(100, 0);
    expect(loaded[0].position.y).toBeCloseTo(50, 0);
    expect(loaded[0].position.z).toBeCloseTo(200, 0);
  });

  test('Handles real MPD files from library', () => {
    const testFiles = [
      '/Users/skasriel/code/qk-lego/server/models/10276-1.mpd',
      '/Users/skasriel/code/qk-lego/server/models/10294-1.mpd',
    ];

    testFiles.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const bricks = mpdToBricks(content);
        
        // Should parse without error
        expect(Array.isArray(bricks)).toBe(true);
        // Should find at least some bricks
        expect(bricks.length).toBeGreaterThan(0);
        
        // Each brick should have required fields
        bricks.slice(0, 5).forEach(brick => {
          expect(brick).toHaveProperty('brickID');
          expect(brick).toHaveProperty('position');
          expect(brick.position).toHaveProperty('x');
          expect(brick.position).toHaveProperty('y');
          expect(brick.position).toHaveProperty('z');
        });
      }
    });
  });
});