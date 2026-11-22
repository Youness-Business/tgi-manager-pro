import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams as useRouterSearchParams,
  type LinkProps as RouterLinkProps,
} from "react-router-dom";
import { useMemo } from "react";

type LinkProps = Omit<RouterLinkProps, "to"> & {
  href: RouterLinkProps["to"];
};

export function Link({ href, ...props }: LinkProps) {
  return <RouterLink to={href} {...props} />;
}

export default Link;

export function usePathname(): string {
  return useLocation().pathname;
}

export function useSearchParams(): URLSearchParams {
  const [searchParams] = useRouterSearchParams();
  return searchParams;
}

export function useRouter() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      push: (href: string) => navigate(href),
      replace: (href: string, options?: { scroll?: boolean }) =>
        navigate(href, {
          replace: true,
          preventScrollReset: options?.scroll === false,
        }),
      back: () => navigate(-1),
      refresh: () => window.location.reload(),
    }),
    [navigate],
  );
}

export { useParams };
