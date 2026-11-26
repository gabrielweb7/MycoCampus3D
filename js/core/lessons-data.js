/**
 * MycoCampus3D — Dados Pedagógicos dos 5 Módulos de Micologia
 */
import { t } from './i18n.js';

export const LESSONS = [
  {
    slug: 'fluxo_laminar',
    get title() { return t('content.lesson.fluxo_laminar.title'); },
    get subtitle() { return t('content.lesson.fluxo_laminar.subtitle'); },
    get bullets() {
      return [
        t('content.lesson.fluxo_laminar.b1'),
        t('content.lesson.fluxo_laminar.b2'),
        t('content.lesson.fluxo_laminar.b3')
      ];
    },
    get question() { return t('content.lesson.fluxo_laminar.q'); },
    options: [
      { get text() { return t('content.lesson.fluxo_laminar.o1'); }, ok: true },
      { get text() { return t('content.lesson.fluxo_laminar.o2'); }, ok: false },
      { get text() { return t('content.lesson.fluxo_laminar.o3'); }, ok: false }
    ]
  },
  {
    slug: 'esterilizacao',
    get title() { return t('content.lesson.esterilizacao.title'); },
    get subtitle() { return t('content.lesson.esterilizacao.subtitle'); },
    get bullets() {
      return [
        t('content.lesson.esterilizacao.b1'),
        t('content.lesson.esterilizacao.b2'),
        t('content.lesson.esterilizacao.b3')
      ];
    },
    get question() { return t('content.lesson.esterilizacao.q'); },
    options: [
      { get text() { return t('content.lesson.esterilizacao.o1'); }, ok: true },
      { get text() { return t('content.lesson.esterilizacao.o2'); }, ok: false },
      { get text() { return t('content.lesson.esterilizacao.o3'); }, ok: false }
    ]
  },
  {
    slug: 'spawn_graos',
    get title() { return t('content.lesson.spawn_graos.title'); },
    get subtitle() { return t('content.lesson.spawn_graos.subtitle'); },
    get bullets() {
      return [
        t('content.lesson.spawn_graos.b1'),
        t('content.lesson.spawn_graos.b2'),
        t('content.lesson.spawn_graos.b3')
      ];
    },
    get question() { return t('content.lesson.spawn_graos.q'); },
    options: [
      { get text() { return t('content.lesson.spawn_graos.o1'); }, ok: true },
      { get text() { return t('content.lesson.spawn_graos.o2'); }, ok: false },
      { get text() { return t('content.lesson.spawn_graos.o3'); }, ok: false }
    ]
  },
  {
    slug: 'contaminacao',
    get title() { return t('content.lesson.contaminacao.title'); },
    get subtitle() { return t('content.lesson.contaminacao.subtitle'); },
    get bullets() {
      return [
        t('content.lesson.contaminacao.b1'),
        t('content.lesson.contaminacao.b2'),
        t('content.lesson.contaminacao.b3')
      ];
    },
    get question() { return t('content.lesson.contaminacao.q'); },
    options: [
      { get text() { return t('content.lesson.contaminacao.o1'); }, ok: true },
      { get text() { return t('content.lesson.contaminacao.o2'); }, ok: false },
      { get text() { return t('content.lesson.contaminacao.o3'); }, ok: false }
    ]
  },
  {
    slug: 'frutificacao',
    get title() { return t('content.lesson.frutificacao.title'); },
    get subtitle() { return t('content.lesson.frutificacao.subtitle'); },
    get bullets() {
      return [
        t('content.lesson.frutificacao.b1'),
        t('content.lesson.frutificacao.b2'),
        t('content.lesson.frutificacao.b3')
      ];
    },
    get question() { return t('content.lesson.frutificacao.q'); },
    options: [
      { get text() { return t('content.lesson.frutificacao.o1'); }, ok: true },
      { get text() { return t('content.lesson.frutificacao.o2'); }, ok: false },
      { get text() { return t('content.lesson.frutificacao.o3'); }, ok: false }
    ]
  }
];
