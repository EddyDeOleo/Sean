# Audio asset manifest

All sound in Sean is synthesised at run time with the Web Audio API. There are no audio files, no samples, no downloads and no third-party sound libraries, so there are no licences or attributions to track. Recorded CC0 samples were considered for the wood sounds and were not needed.

Source files (`frontend/src/features/audio/`):

| File | Content |
|---|---|
| `AudioController.ts` | Context, buses, master gain, compressor, final limiter, beds, concurrency, intense-cue switch |
| `cues.ts` | The procedural one-shot cues (wood, friction, creak, scream, creature, distant sounds) |
| `beds.ts` | The Ouija room bed and its crackle buffer |
| `synth.ts` | Seeded random numbers, envelope helpers, the per-cue node `Rig`, distortion and limiter curves |
| `director.ts` | Which sound goes with which phase, Ouija step, game event and threat |

## Rules

- Sound is on by default (Spec 4 section 17.6). Browsers only allow audio after a gesture, so it starts with the first click or key press in the page. The on or off choice, the volume and the mute are stored.
- Master volume, ambient level, effects level and mute are in Settings. The master gain is capped (`MASTER_CEILING`), then passes a compressor and a soft limiter.
- Sound belongs to the interlude. It never plays for an investigation result. The interlude does not run for failed, cancelled or insufficient results, saved reports or when the user turned the experience off.
- Leaving the interlude sets the mood to silent. Turning sound off or unmounting the app stops every source, disconnects every node and closes the context.
- At most six one-shot cues play together (`MAX_CONCURRENT_CUES`). A cue played with `priority: true` may use up to three more (`PRIORITY_EXTRA_CUES`), so the scream and the heartbeat are never dropped.
- Every cue is deterministic: its small variations come from a generator seeded by the cue name and how many times it has played. The same session plays the same sounds.
- If Web Audio is missing or fails, sound is reported as unavailable and nothing else is affected.

## Safety limits

- The final stage is a soft limiter (`createWaveShaper`, ceiling 0.7, about -3.1 dBFS) after the compressor. Without WaveShaper support the cues' own levels and the compressor are the only protection, and the scream is not distorted.
- The scream is never louder than -3 dBFS at master volume 1.0, ambient 1.0 and effects 1.0. This is measured (table below), with and without WaveShaper, alone, over the Ouija bed, and in the worst jumpscare mix (scream, caught impact, thud, growl, step, breath, heartbeat and tension bed together).
- `AudioController.setIntenseAllowed(false)` skips the scream and softens the `caught` impact (lower level, slower attack, no crack). Mute and the volume sliders apply as for any cue. Cues already playing are not cut.
- The decay of the scream is 1.4 s measured (above -60 dBFS). It starts in 4 ms and ends by 1.56 s.

## Beds (loops, cross-faded, ambient bus)

| Mood | Used in | Character |
|---|---|---|
| ouija | Ouija introduction and board | Quiet room tone (low-passed noise), wood resonance (narrow noise bands at 165 and 245 Hz, slow tones at 57 and 87.5 Hz), faint candle crackle (sparse clicks from one cached 5.3 s buffer stored at 22.05 kHz), distant creak (slow pitch-wandering saw through a narrow band) |
| idle, search | not used by the director any more | low triangle drone, slow filter wobble |
| tension | interruption and game | lower, darker drone, faster wobble. The ambient bus swells with the creature's nearness (`setTension`) |
| escape | after leaving the game | warmer, noisier bed |

## Cues (one-shots, effects bus)

| Cue | When | How it is made |
|---|---|---|
| woodKnock | Ouija board settles | modal synthesis: four sine partials at 1, 2.27, 3.93, 5.61 times about 250 Hz, each with its own decay, plus a 12 ms band-passed noise click |
| woodThud | Ouija board settles | modal body at about 160 Hz with a 100 Hz thump and a dull noise click |
| planchetteTick | each planchette move | felt on wood: two grain ticks, a short low thump, a faint 390 Hz ring |
| planchetteSlide | each planchette move | two band-passed noise layers whose centre frequency and level drift irregularly, with stick-slip pulses |
| woodCreak | some planchette moves, the house | sawtooth with sliding, jittering pitch, rough 40 Hz amplitude modulation, two moving resonant formant filters |
| scream | the player is caught (jumpscare on) | four detuned saw and square voices with a fast upward pitch sweep and vibrato, optional waveshaper distortion, two moving formant filters, noise burst, sub thump. Intense, priority |
| caught | the player is caught | heavy impact: falling sub tone, low wood body, noise crack. Intense: softened when intense sound is off |
| monsterStep | creature approaches | heel strike and a slightly later sole slap, about 90 Hz body, random but seeded pitch and gap. Paced with an uneven gait by `MonsterSteps` |
| breath | creature within 14 tiles | band-passed noise: thin inhale, longer lower exhale, 58 Hz rasp modulation, faint 92 Hz vocal resonance |
| heartbeat | tension at least 0.2 | lub and a softer dub 0.2 s later. 55 bpm at tension 0, 130 bpm at 1. Priority |
| proximity | creature within 6 tiles | rising saw and sub drone that swells. Plays once per approach |
| drip, pipeTick, rumble | the house, on a fixed schedule of game time | drop with echo, metallic double tick, low noise and sine rumble |
| whisper | Ouija introduction | band-passed noise |
| planchette, settle | older cues, still available | scrape and short thud |
| glitch | interruption begins | saw sweep and noise |
| clue, door, escape | clue, gate, escape | rising sine, low square, rising sines |
| footstep, footstepRun | player steps | short filtered noise and thump |
| flashlight | F pressed | click |
| growl | the creature starts pursuing | low saws, panned toward the creature |

Spatial placement uses `StereoPannerNode` when the browser offers it. Otherwise cues play centred.

## Measured results

All numbers come from `frontend/e2e/audio/cues.spec.ts`, which renders the real controller through an `OfflineAudioContext` in Microsoft Edge at 44.1 kHz, with master volume, ambient and effects at 1.0 (the worst case). Peak is the larger channel. Duration is the span above -60 dBFS. Attack is the time from 1% of the peak to 90% of the peak. These are measurements. Nobody listened to the files while they were produced.

| Cue | Duration s | Attack ms | Peak dBFS | RMS dBFS | Centroid Hz | Dominant band Hz |
|---|---|---|---|---|---|---|
| woodKnock | 0.31 | 2.5 | -6.8 | -22.9 | 356 | 150-300 |
| woodThud | 0.38 | 1.2 | -6.5 | -22.7 | 191 | 150-300 |
| planchetteTick | 0.06 | 6.6 | -11.6 | -25.1 | 214 | 80-150 |
| planchetteSlide | 0.98 | 380 | -9.1 | -26.5 | 2896 | 1200-2400 |
| woodCreak | 0.68 | 103 | -16.1 | -30.0 | 993 | 600-1200 |
| scream | 1.44 | 7.5 | -6.1 | -22.6 | 1208 | 600-1200 |
| scream, no waveshaper | 1.42 | 8.0 | -5.9 | -26.2 | 918 | 600-1200 |
| caught | 0.51 | 14.9 | -6.5 | -21.2 | 120 | 0-80 |
| caught, softened | 0.44 | 27.6 | -13.7 | -28.2 | 94 | 0-80 |
| monsterStep | 0.15 | 1.3 | -7.0 | -16.1 | 125 | 80-150 |
| breath | 1.04 | 740 | -11.1 | -30.9 | 2381 | 1200-2400 |
| heartbeat | 0.31 | 7.6 | -9.1 | -22.8 | 85 | 80-150 |
| drip | 0.23 | 2.0 | -13.1 | -31.2 | 1571 | 1200-2400 |
| pipeTick | 0.22 | 1.3 | -8.1 | -17.3 | 917 | 600-1200 |
| rumble | 2.37 | 1044 | -9.6 | -20.0 | 54 | 0-80 |
| proximity | 1.66 | 1022 | -7.2 | -21.8 | 101 | 0-80 |
| Ouija bed (9 s) | 8.9 | n/a | -16.4 | -30.7 | 102 | 0-80 |
| worst jumpscare mix | 2.37 | n/a | -4.5 | -11.8 | 73 | 0-80 |

At the default volume (0.35) every level is about 9 dB lower. Several cues have their energy below 150 Hz (the heartbeat, rumble, proximity drone, the caught impact). Laptop speakers reproduce little there, so those cues are measured as present but may be faint on small speakers. Headphones show them best.

What the automated assertions check:

- Every cue: peak at most -3 dBFS, no clipping, audible tail within its duration (`cueDurationSeconds`), `activeCues` back to 0 once cues end and after dispose, no failure flag.
- Wood: energy falls between successive windows, at least 70% of the energy is inside the body range (150-1500 Hz for the knock, 60-1500 Hz for the thud), the first 12 ms has more high-frequency content than the ring, at least three spectral peaks, and a spectrum flatter than a decaying 250 Hz sine measured the same way.
- Friction: more than 60% of the energy between 600 and 4000 Hz, a spectrum far flatter than a tone, an irregular 10 ms envelope.
- Scream: peak between -12 and -3 dBFS, RMS between -30 and -12 dBFS, centroid between 800 and 3500 Hz, 90% of peak within 30 ms, duration between 1.0 and 1.8 s, not clipped, silent when intense sound is refused.
- Heartbeat: detected beat rate within 3% of 55, 90 and 130 bpm, with the dub 0.12 to 0.28 s after the lub.
- Ouija bed: no clipping, quiet, mostly low, with sparse crackle pops after a 1.8 kHz high-pass.
- Identical renders: two renders of the same cues are the same to 1e-6.

An offline render schedules every cue before any ends, so the concurrency cap is not modelled there. It is tested with the fake context in `frontend/tests/audioCues.test.ts`.

## How to regenerate and listen

```powershell
cd frontend
npx playwright test -c playwright.audio.config.ts
```

This starts only a Vite dev server on port 5373 (no backend) and uses the installed Edge. It writes one WAV per cue (16-bit PCM stereo, 44.1 kHz, rendered at the worst-case levels above, so quieter than full scale and not normalised), plus `report.json` and `report.md`, to `%TEMP%\sean-audio\`. The audio specs skip themselves when run with the main `playwright.config.ts`.
