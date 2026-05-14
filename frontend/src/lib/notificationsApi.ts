const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export type PushUserType = "client" | "driver" | "admin";

export async function subscribeToPushOnBackend(params: {
  userType: PushUserType;
  userId?: number | null;
  subscription: PushSubscription;
}) {
//   const raw = subscription.toJSON();
  const raw = params.subscription.toJSON();

  const response = await fetch(`${API_BASE_URL}/notifications/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_type: params.userType,
      user_id: params.userId ?? null,
      endpoint: raw.endpoint,
      keys: {
        p256dh: raw.keys?.p256dh,
        auth: raw.keys?.auth,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to save push subscription.");
  }

  return response.json();
}

export async function unsubscribeFromPushOnBackend(subscription: PushSubscription) {
  const raw = subscription.toJSON();

  const response = await fetch(`${API_BASE_URL}/notifications/unsubscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      endpoint: raw.endpoint,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to unsubscribe from push notifications.");
  }

  return response.json();
}