import { PortfolioItem } from './types';

export const INITIAL_PORTFOLIO: PortfolioItem[] = [
  {
    id: '1',
    category: 'Illustration',
    title: 'Forest Guardian',
    application: 'Conceptual Art',
    description: 'A mystical character illustration in a glowing forest environment.',
    images: [
      { url: 'https://picsum.photos/seed/forest/800/1000', title: 'Forest Guardian - Primary' },
      { url: 'https://picsum.photos/seed/forest2/800/1000', title: 'Forest Guardian - Detail' }
    ],
    client: 'Personal Project',
    role: 'Full Process',
    process: ['Character Design', 'Environment Sketching', 'Lighting & Color', 'Final Polish']
  },
  {
    id: '2',
    category: 'Sketch',
    title: 'Anatomy Study #04',
    application: 'Fine Art',
    description: 'Detailed pencil study of muscular structures and dynamic posing.',
    images: [{ url: 'https://picsum.photos/seed/sketch/800/1200', title: 'Anatomy Study - Pencil' }],
    process: ['Rough Gesture', 'Muscle Construction', 'Pencil Shading']
  },
  {
    id: '3',
    category: 'Dot Art',
    title: 'Cyberpunk Room',
    application: 'Environment Design',
    description: '16-bit isometric pixel art of a futuristic living space.',
    images: [{ url: 'https://picsum.photos/seed/pixel/800/800', title: 'Cyberpunk Room - Pixel Art' }],
    process: ['Grid Setup', 'Tile Mapping', 'Animation Frames']
  },
  {
    id: '4',
    category: 'Projects',
    title: 'Mobile Game Art Kit',
    application: 'UI/UX Identity',
    description: 'A comprehensive visual asset package for an unannounced RPG project.',
    images: [
      { url: 'https://picsum.photos/seed/game/1000/600', title: 'RPG Asset Pack' },
      { url: 'https://picsum.photos/seed/ui/1000/600', title: 'UI Concept' }
    ],
    client: 'Indie Game Studio X',
    role: 'Lead Artist',
    process: ['Conceptual Art', 'UI Icons', 'Character Sprites']
  }
];

export const SERVICE_STEPS = [
  { title: '문의 접수', description: '의뢰 내용을 확인하고 1차 상담을 진행합니다.' },
  { title: '상담 진행', description: '세부 컨셉, 작업 일정 및 범위를 논의합니다.' },
  { title: '견적 안내', description: '최종 견적서 전달 및 계약 체결을 완료합니다.' },
  { title: '스케치 초안', description: '러프 스케치 및 컬러 가이드를 공유하고 컨셉을 확정합니다.' },
  { title: '수정 작업', description: '확정된 초안을 바탕으로 디테일 묘사 및 수정을 진행합니다.' },
  { title: '최종 전달', description: '완성된 고해상도 이미지 파일을 최종 전달합니다.' }
];

export const CATEGORIES: string[] = ['Illustration', 'Sketch', 'Dot Art', 'Projects'];
