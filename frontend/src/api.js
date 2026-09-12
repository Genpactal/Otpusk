export async function api(path, user, body) {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', 'X-Demo-User': user },
    ...(body !== undefined ? { method: 'POST', body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to complete this action.');
  return data;
}
