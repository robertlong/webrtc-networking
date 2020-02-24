export default function Loading({ error, isLoading }) {
  if (error) {
    console.error(error);
    return <div style={{ color: "red" }}><h3>Error loading component:</h3><code style={{ whiteSpace: "pre" }}>{error.message}<br/>{error.stack}</code></div>;
  } else if (isLoading) {
    return <div>Loading...</div>;
  }
  return null;
}