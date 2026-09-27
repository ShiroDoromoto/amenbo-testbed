import type { ComponentChildren } from 'preact';
import { matchPath, type RouteParams } from './match.ts';
import { useHashPath } from './useHashPath.ts';

export type Route = {
  /** `/transactions` や `/transactions/:id` の形で書く */
  path: string;
  render: (params: RouteParams) => ComponentChildren;
};

type Props = {
  /** 上から順に調べ、最初に合ったものを出す */
  routes: readonly Route[];
  /** どれにも合わないときに出す */
  notFound: (path: string) => ComponentChildren;
};

export function Router({ routes, notFound }: Props) {
  const path = useHashPath();
  for (const route of routes) {
    const params = matchPath(route.path, path);
    if (params) return <>{route.render(params)}</>;
  }
  return <>{notFound(path)}</>;
}
