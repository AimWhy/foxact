import { useSyncExternalStore, useCallback, useEffect } from 'react';
import { noop } from '../noop';
import { useIsomorphicLayoutEffect } from '../use-isomorphic-layout-effect';
import { noSSR } from '../no-ssr';

function dispatchStorageEvent(key: string, newValue: string | null) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
  }
}

const setLocalStorageItem = (key: string, value: any) => {
  if (typeof window !== 'undefined') {
    const stringifiedValue = JSON.stringify(value);
    try {
      window.localStorage.setItem(key, stringifiedValue);
    } catch (e) {
      console.error(e);
    } finally {
      dispatchStorageEvent(key, stringifiedValue);
    }
  }
};

const removeLocalStorageItem = (key: string) => {
  if (typeof window !== 'undefined') {
    try {
      // Some environments will disallow localStorage access
      window.localStorage.removeItem(key);
    } catch (e) {
      console.error(e);
    } finally {
      dispatchStorageEvent(key, null);
    }
  }
};

const getLocalStorageItem = (key: string) => {
  if (typeof window !== 'undefined') {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      console.warn(e);
      return null;
    }
  }
  return null;
};

const subscribeToLocalStorage = (callback: () => void) => {
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', callback);
    return () => window.removeEventListener('storage', callback);
  }
  return noop;
};

const getServerSnapshotWithoutServerValue = () => noSSR('foxact: useLocalStorage without `serverValue` will only be used at client side.');

// This type utility is only used for workaround https://github.com/microsoft/TypeScript/issues/37663
// eslint-disable-next-line @typescript-eslint/ban-types -- workaround TypeScript bug
const isFunction = (x: unknown): x is Function => typeof x === 'function';

/** @see https://foxact.skk.moe/use-local-storage */
export const useLocalStorage = <T extends string | number>(key: string, serverValue?: T) => {
  const getSnapshot = () => getLocalStorageItem(key);

  // If the serverValue is provided, we pass it to useSES' getServerSnapshot, which will be used during SSR
  // If the serverValue is not provided, we don't pass it to useSES, which will cause useSES to opt-in client-side rendering
  const getServerSnapshot = typeof serverValue !== 'undefined'
    ? () => JSON.stringify(serverValue)
    : getServerSnapshotWithoutServerValue;

  const store = useSyncExternalStore(
    subscribeToLocalStorage,
    getSnapshot,
    getServerSnapshot
  );

  const setState = useCallback<React.Dispatch<React.SetStateAction<T | null | undefined>>>(
    (v) => {
      try {
        const nextState = isFunction(v)
          ? v(store != null ? JSON.parse(store) : null)
          : v;

        if (nextState === undefined || nextState === null) {
          removeLocalStorageItem(key);
        } else {
          setLocalStorageItem(key, nextState);
        }
      } catch (e) {
        console.warn(e);
      }
    },
    [key, store]
  );

  useIsomorphicLayoutEffect(() => {
    if (
      getLocalStorageItem(key) === null
      && typeof serverValue !== 'undefined'
    ) {
      setLocalStorageItem(key, serverValue);
    }
  }, [key, serverValue]);

  return [store != null ? JSON.parse(store) : serverValue, setState];
};
