'use dom';

import React, { useEffect, useRef } from 'react';
import type { DOMProps } from 'expo/dom';
import type { GameMap, Token } from '@dmai/shared';
import { Board } from './board';

export interface BoardCommand {
  id: number;
  kind: 'recenter' | 'zoomIn' | 'zoomOut';
}

interface Props {
  map: GameMap;
  fog: string[] | null;
  tokens: Token[];
  moveTargets: { x: number; y: number }[];
  targetIds: string[];
  focusId: string | null;
  mode: '2d' | '3d';
  command: BoardCommand | null;
  onTileTap: (x: number, y: number) => Promise<void> | void;
  onTokenTap: (id: string) => Promise<void> | void;
  dom?: DOMProps;
}

export default function BoardView({ map, fog, tokens, moveTargets, targetIds, focusId, mode, command, onTileTap, onTokenTap }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const board = useRef<Board | null>(null);
  const handlers = useRef({ onTileTap, onTokenTap });
  handlers.current = { onTileTap, onTokenTap };
  const inWebView = typeof window !== 'undefined' && 'ReactNativeWebView' in window;

  useEffect(() => {
    if (inWebView) {
      document.documentElement.style.height = '100%';
      document.body.style.margin = '0';
      document.body.style.height = '100%';
      document.body.style.background = '#0d0a08';
      document.body.style.overflow = 'hidden';
    }
    const b = new Board(host.current!, {
      onTileTap: (x, y) => void handlers.current.onTileTap(x, y),
      onTokenTap: (id) => void handlers.current.onTokenTap(id),
    });
    board.current = b;
    return () => {
      b.dispose();
      board.current = null;
    };
  }, [inWebView]);

  useEffect(() => {
    board.current?.setMode(mode);
  }, [mode]);

  useEffect(() => {
    board.current?.update({ map, fog, tokens, moveTargets, targetIds, focusId });
  }, [map, fog, tokens, moveTargets, targetIds, focusId]);

  useEffect(() => {
    if (!command || !board.current) return;
    if (command.kind === 'recenter') board.current.recenter();
    else board.current.zoomBy(command.kind === 'zoomIn' ? 0.8 : 1.25);
  }, [command]);

  return <div ref={host} style={{ width: '100%', height: inWebView ? '100vh' : '100%', position: 'relative', overflow: 'hidden', background: '#0d0a08' }} />;
}
