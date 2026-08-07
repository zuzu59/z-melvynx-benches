# Car Brick Wall Crash

Single-file canvas physics experiment where a car crashes into a configurable brick wall with realistic momentum, mass, friction, and collapse behavior.

## Challenge

Generate a single, self-contained HTML file that runs directly in a browser.

Build a realistic 2D crash experiment on a canvas: a car accelerates from the left side of the scene and crashes into a freestanding brick wall. The wall is made of individual physical bricks, not a static image. When the user starts the test, the car must hit the wall, transfer momentum into the bricks, and cause the wall to deform, collapse, scatter, or partially survive according to the simulated physics.

## Core Experience

The page has one primary experiment view:

- A side-view test track.
- A car waiting on the left.
- A brick wall standing on the right.
- A clearly visible "Test" button.
- A settings menu that lets the user change the experiment parameters.

When the user clicks "Test":

1. The scene resets to the current settings.
2. The car launches toward the brick wall.
3. The car collides with the bricks.
4. The bricks respond as separate bodies with mass, friction, gravity, contact, rotation, and momentum transfer.
5. The wall collapses, deforms, or partially survives based on the physics simulation.

## Settings (Configurable Parameters)

Users can adjust:

- **Car speed** — how fast the car approaches the wall
- **Car mass** — heavier cars transfer more momentum
- **Brick count** — width of the wall (number of bricks)
- **Brick material** — wood, brick, concrete, glass (affects strength and fragmentation)
- **Gravity** — simulation gravity strength
- **Friction** — ground and brick-to-brick friction
- **Replay** — ability to rewatch the crash

## Physics Requirements

- Each brick is an independent rigid body with its own position, velocity, rotation, and mass.
- Realistic collision detection between bricks and between bricks and the car.
- Momentum transfer on impact — faster/heavier cars cause more destruction.
- Bricks can tumble, slide, stack, or scatter realistically.
- The car itself should react to impact (decelerate, bounce, or crumple).

## Deliverable

- One `index.html` file in the `Car_Brick_Wall_Crash/` directory.
- No external dependencies — pure HTML, CSS, and vanilla JavaScript.
- Must run by simply opening the file in a browser.
