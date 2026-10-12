# VOID sandbox upgrade

Goal: a Turkish, uncluttered space sandbox with visible persistent consequences and an explicitly fictional population model. Preserve GitHub Pages, Three.js and the current planets.

Implementation: replace the overlaid HUD with a compact collapsible left panel, a scene-first canvas and bottom population summary. Retain orbit/flight, add touch movement, flight speed and keyboard shortcuts. Expand impacts to 20 km asteroids and 99.99% c; add Moon impact and solar expansion presets. Render persistent scars, ejecta, heat and fragmentation only at extreme energies. Keep input parameters frozen per launched experiment. Reset restores Earth, lights, objects and population; exploration preserves experiments.

Model: real kinetic-energy formulas; fictional bounded casualty fraction influenced by population, exposure and shelter assumptions. No scientific death prediction. Model explanation visible beside counters. Numerical outcome applies on impact, never on parameter preview. Population is editable 0–20 billion. Use staged sun and gravity exposure with explicitly game-defined coefficients.

Verification: energy scaling, finite endpoints, zero-population, survivor bounds, monotonic damage, low-energy no-fragmentation, high-energy fragmentation and reset. Build production bundle; exercise desktop/mobile and scenario switching if browser support is available. Publish checked changes to existing main and verify Actions.
