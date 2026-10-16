export function sqliteDirectoryUri(path: string) {
  // SQLite's Android default is an absolute native path; FileSystem needs a
  // file URI. Encode literal percent signs as well as spaces in Expo Go scopes.
  if (path.startsWith("/"))
    return `file://${path.split("/").map(encodeURIComponent).join("/")}`;
  const uri = new URL(path);
  if (uri.protocol !== "file:" || uri.host || !uri.pathname.startsWith("/"))
    throw new Error("Invalid local database directory.");
  return path;
}
