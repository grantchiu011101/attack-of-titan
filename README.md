# Attack of Titan

Browser ODM action game inspired by [AoTTG2](https://aottg2.com/). PlayCanvas in the client, Firebase for auth / Remote Config / scores, Stripe for Scout Pass.

Unofficial fan tribute. Not affiliated with Kodansha, MAPPA, or the AoTTG2 team.

## Play

```bash
npm install
npm run dev
```

Open the Vite URL, click **Singleplayer Waves**, then click the canvas to lock the mouse.

| Action | Key |
| --- | --- |
| Move | WASD |
| Left / right hook | Q / E (hold) |
| Gas boost | Shift or Space |
| Slash nape | Left mouse |
| Pause | Esc |

Mobile: left stick, right look pad, Q/E/GAS/SLASH buttons.

## Backend

1. Copy `.env.example` to `.env` and fill Firebase + Stripe publishable keys.
2. Enable **Google** and **Phone** in Firebase Auth.
3. Publish `remoteconfig.template.json` parameters.
4. Deploy functions with `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
5. Set `scout_pass_price_id` and `gas_pack_price_id` in Remote Config.

Without keys the game runs in guest/demo mode (local profile, simulated checkout).

A/B: sticky bucket in `localStorage` (`aot-ab-bucket`). Bucket A = classic HUD + tutorial + nape glow. Bucket B = compact HUD, no tutorial, nape glow only in slash range.
