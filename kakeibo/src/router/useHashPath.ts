import { useEffect, useState } from 'preact/hooks';
import { pathFromHash } from './hash.ts';

/** いまのハッシュのパスを返し、`hashchange` のたびに描き直す */
export function useHashPath(): string {
  const [path, setPath] = useState(() => pathFromHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setPath(pathFromHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    // 登録までの間にハッシュが変わっていても取りこぼさない
    onHashChange();
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return path;
}
