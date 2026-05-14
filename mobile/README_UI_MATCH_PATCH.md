# TankUp mobile UI/UX match patch

This patch moves the Expo mobile client flow closer to the web frontend structure:

- `components/ClientView.tsx`
- `components/client/ClientShell.tsx`
- `components/client/RequestStep.tsx`
- `components/client/PaymentStep.tsx`
- `components/client/StatusSteps.tsx`
- `hooks/useClientFlow.ts`
- `types/client.ts`
- updated `app/(tabs)/index.tsx`
- updated `app/(tabs)/request.tsx`

The mobile app now mirrors the web frontend pattern:

`Home role selector -> ClientView -> RequestStep -> PaymentStep -> Batch/Tanker/Delivery/Completed steps`

Notes:
- This is UI/UX + structure parity, not full backend parity yet.
- Batch live polling, priority resume, driver flow, OTP backend verification, and map tracking should be added in the next patch.
- I could not run a real TypeScript compile inside this sandbox because the uploaded zip does not include installed `node_modules`; run `npm install` then `npx expo start -c` in your local project.
