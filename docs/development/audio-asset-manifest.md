# Audio asset manifest

All sound in Sean is synthesised at run time with the Web Audio API (`frontend/src/features/audio/AudioController.ts`). There are no audio files, no samples, no downloads and no third-party sound libraries, so there are no licences or attributions to track.

## Rules

- Sound is off whenever the page opens. It starts only after the user turns it on in Settings or on the game's first screen (a user gesture). "On" is never stored. Volumes and mute are stored.
- Master volume, ambient level, effects level and mute are in Settings. The master gain is capped (`MASTER_CEILING`) and passes a compressor.
- Sound belongs to the interlude. It never plays for an investigation result. The interlude does not run for failed, cancelled or insufficient results, saved reports or when the user turned the experience off.
- Leaving the interlude sets the mood to silent. Turning sound off or unmounting the app stops every source, disconnects every node and closes the context. At most six one-shot cues play together.
- If Web Audio is missing or fails, sound is reported as unavailable and nothing else is affected.

## Beds (loops, cross-faded, ambient bus)

| Mood | Used in | Character |
|---|---|---|
| idle | Ouija introduction | low triangle drone, slow filter wobble |
| search | planchette moves | same drone, slightly brighter |
| tension | interruption and game | lower, darker drone, faster wobble. The ambient bus swells with the creature's nearness (`setTension`) |
| escape | after leaving the game | warmer, noisier bed |

## Cues (one-shots, effects bus)

| Cue | When | Notes |
|---|---|---|
| whisper | Ouija introduction | band-passed noise |
| planchette | each planchette step | low scrape (noise) |
| settle | planchette settles | short thud |
| glitch | interruption begins | saw sweep and noise |
| clue | clue collected | rising sine |
| door | gate opens | low square |
| footstep, footstepRun | player steps (walking, sprinting) | short filtered noise and thump. Running is louder (and the creature hears it) |
| flashlight | F pressed | click |
| growl | the creature starts pursuing | positioned left or right with a stereo panner according to where it is |
| monsterStep | creature approaches | positioned, paced and louder with proximity |
| caught | the player is caught | low saw |
| escape | the player escapes | rising sines |

Spatial placement uses `StereoPannerNode` when the browser offers it; otherwise cues play centred.
