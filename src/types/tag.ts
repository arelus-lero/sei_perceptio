export interface TagItem {
  id: string;
  nome: string;
  cor: string;
  created_at: string;
}

export interface TagWithUsage extends TagItem {
  fontes_count?: number;
}

export interface CreateTagBody {
  nome: string;
  cor?: string;
}

export interface UpdateTagBody {
  nome?: string;
  cor?: string;
}

export interface LinkFonteTagBody {
  tag_id: string;
}

export interface UnlinkFonteTagBody {
  tag_id: string;
}
