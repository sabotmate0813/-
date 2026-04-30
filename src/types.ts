export type Category = 'All' | 'Illustration' | 'Sketch' | 'Dot Art' | 'Projects';

export interface PortfolioImage {
  url: string;
  title?: string;
}

export interface PortfolioItem {
  id: string;
  category: Category;
  title: string;
  application: string; // Refers to the "APPLICATION" field in screenshot (e.g. "Game Art", "Logo Design")
  description: string;
  images: PortfolioImage[]; // Use objects to support image-specific titles
  client?: string;
  role?: string;
  process?: string[];
}

export interface ServiceStep {
  title: string;
  description: string;
}
