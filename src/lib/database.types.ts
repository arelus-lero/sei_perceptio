export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      alerta: {
        Row: {
          data_criacao: string
          descricao: string
          id: string
          lido: boolean
          monitoramento_id: string
          orgao_id: string
          processo_id: string
          tipo_evento: string
        }
        Insert: {
          data_criacao?: string
          descricao: string
          id?: string
          lido?: boolean
          monitoramento_id: string
          orgao_id: string
          processo_id: string
          tipo_evento: string
        }
        Update: {
          data_criacao?: string
          descricao?: string
          id?: string
          lido?: boolean
          monitoramento_id?: string
          orgao_id?: string
          processo_id?: string
          tipo_evento?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerta_monitoramento_id_fkey"
            columns: ["monitoramento_id"]
            isOneToOne: false
            referencedRelation: "monitoramento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerta_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerta_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processo"
            referencedColumns: ["id"]
          },
        ]
      }
      andamento: {
        Row: {
          created_at: string
          data_hora: string
          descricao: string
          id: string
          orgao_id: string
          processo_id: string
          processo_referenciado_id: string | null
          relator_id: string | null
          resultado_deliberativo: string | null
          sessao_distribuicao: string | null
          tipo: string
          unidade: string
        }
        Insert: {
          created_at?: string
          data_hora: string
          descricao: string
          id?: string
          orgao_id: string
          processo_id: string
          processo_referenciado_id?: string | null
          relator_id?: string | null
          resultado_deliberativo?: string | null
          sessao_distribuicao?: string | null
          tipo: string
          unidade: string
        }
        Update: {
          created_at?: string
          data_hora?: string
          descricao?: string
          id?: string
          orgao_id?: string
          processo_id?: string
          processo_referenciado_id?: string | null
          relator_id?: string | null
          resultado_deliberativo?: string | null
          sessao_distribuicao?: string | null
          tipo?: string
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "andamento_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "andamento_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "andamento_processo_referenciado_id_fkey"
            columns: ["processo_referenciado_id"]
            isOneToOne: false
            referencedRelation: "processo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "andamento_relator_id_fkey"
            columns: ["relator_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["user_id"]
          },
        ]
      }
      anexacao: {
        Row: {
          chamado_suporte: string | null
          created_at: string
          data_anexacao: string
          data_desanexacao: string | null
          id: string
          orgao_id: string
          processo_filho_id: string
          processo_pai_id: string
        }
        Insert: {
          chamado_suporte?: string | null
          created_at?: string
          data_anexacao: string
          data_desanexacao?: string | null
          id?: string
          orgao_id: string
          processo_filho_id: string
          processo_pai_id: string
        }
        Update: {
          chamado_suporte?: string | null
          created_at?: string
          data_anexacao?: string
          data_desanexacao?: string | null
          id?: string
          orgao_id?: string
          processo_filho_id?: string
          processo_pai_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anexacao_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexacao_processo_filho_id_fkey"
            columns: ["processo_filho_id"]
            isOneToOne: false
            referencedRelation: "processo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexacao_processo_pai_id_fkey"
            columns: ["processo_pai_id"]
            isOneToOne: false
            referencedRelation: "processo"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          acao: string
          data_criacao: string
          detalhes_json: Json
          entidade_id: string | null
          entidade_tipo: string
          id: string
          ip_address: unknown
          orgao_id: string
          user_agent: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          data_criacao?: string
          detalhes_json?: Json
          entidade_id?: string | null
          entidade_tipo: string
          id?: string
          ip_address?: unknown
          orgao_id: string
          user_agent?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          data_criacao?: string
          detalhes_json?: Json
          entidade_id?: string | null
          entidade_tipo?: string
          id?: string
          ip_address?: unknown
          orgao_id?: string
          user_agent?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
        ]
      }
      chunk: {
        Row: {
          conteudo: string
          created_at: string
          embedding: string | null
          fonte_id: string
          id: string
          metadados_json: Json
          orgao_id: string
          posicao_fim: number
          posicao_inicio: number
          tsv: unknown
        }
        Insert: {
          conteudo: string
          created_at?: string
          embedding?: string | null
          fonte_id: string
          id?: string
          metadados_json?: Json
          orgao_id: string
          posicao_fim: number
          posicao_inicio: number
          tsv?: unknown
        }
        Update: {
          conteudo?: string
          created_at?: string
          embedding?: string | null
          fonte_id?: string
          id?: string
          metadados_json?: Json
          orgao_id?: string
          posicao_fim?: number
          posicao_inicio?: number
          tsv?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "chunk_fonte_id_fkey"
            columns: ["fonte_id"]
            isOneToOne: false
            referencedRelation: "fonte"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunk_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
        ]
      }
      compartilhamento: {
        Row: {
          compartilhado_por_id: string
          data_compartilhamento: string
          id: string
          notebook_id: string
          orgao_id: string
          permissao: string
          usuario_destino_id: string
        }
        Insert: {
          compartilhado_por_id: string
          data_compartilhamento?: string
          id?: string
          notebook_id: string
          orgao_id: string
          permissao: string
          usuario_destino_id: string
        }
        Update: {
          compartilhado_por_id?: string
          data_compartilhamento?: string
          id?: string
          notebook_id?: string
          orgao_id?: string
          permissao?: string
          usuario_destino_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compartilhamento_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebook"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compartilhamento_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
        ]
      }
      consulta_publica: {
        Row: {
          created_at: string
          data_abertura: string
          data_encerramento_efetiva: string
          data_encerramento_original: string
          id: string
          orgao_id: string
          processo_id: string
          status_inferido: string
        }
        Insert: {
          created_at?: string
          data_abertura: string
          data_encerramento_efetiva: string
          data_encerramento_original: string
          id?: string
          orgao_id: string
          processo_id: string
          status_inferido: string
        }
        Update: {
          created_at?: string
          data_abertura?: string
          data_encerramento_efetiva?: string
          data_encerramento_original?: string
          id?: string
          orgao_id?: string
          processo_id?: string
          status_inferido?: string
        }
        Relationships: [
          {
            foreignKeyName: "consulta_publica_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consulta_publica_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processo"
            referencedColumns: ["id"]
          },
        ]
      }
      conversa: {
        Row: {
          data_criacao: string
          data_ultima_interacao: string
          id: string
          notebook_id: string
          orgao_id: string
          titulo: string | null
          usuario_id: string
        }
        Insert: {
          data_criacao?: string
          data_ultima_interacao?: string
          id?: string
          notebook_id: string
          orgao_id: string
          titulo?: string | null
          usuario_id: string
        }
        Update: {
          data_criacao?: string
          data_ultima_interacao?: string
          id?: string
          notebook_id?: string
          orgao_id?: string
          titulo?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversa_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebook"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversa_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
        ]
      }
      documento: {
        Row: {
          caminho_arquivo: string | null
          checksum: string | null
          conteudo_texto: string | null
          created_at: string
          data_documento: string | null
          data_inclusao: string | null
          id: string
          numero_sei: string
          orgao_id: string
          processo_id: string
          tipo_documento_codigo: string
          tipo_documento_desc: string
          unidade_geradora: string
          updated_at: string
        }
        Insert: {
          caminho_arquivo?: string | null
          checksum?: string | null
          conteudo_texto?: string | null
          created_at?: string
          data_documento?: string | null
          data_inclusao?: string | null
          id?: string
          numero_sei: string
          orgao_id: string
          processo_id: string
          tipo_documento_codigo: string
          tipo_documento_desc: string
          unidade_geradora: string
          updated_at?: string
        }
        Update: {
          caminho_arquivo?: string | null
          checksum?: string | null
          conteudo_texto?: string | null
          created_at?: string
          data_documento?: string | null
          data_inclusao?: string | null
          id?: string
          numero_sei?: string
          orgao_id?: string
          processo_id?: string
          tipo_documento_codigo?: string
          tipo_documento_desc?: string
          unidade_geradora?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documento_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processo"
            referencedColumns: ["id"]
          },
        ]
      }
      fonte: {
        Row: {
          anonimizada: boolean
          ativa: boolean
          caminho_arquivo: string | null
          checksum: string | null
          conteudo_texto: string | null
          created_at: string
          data_ingestao: string
          documento_sei_id: string | null
          id: string
          metadados_json: Json
          notebook_id: string
          orgao_id: string
          tipo_origem: string
          titulo: string
          url: string | null
        }
        Insert: {
          anonimizada?: boolean
          ativa?: boolean
          caminho_arquivo?: string | null
          checksum?: string | null
          conteudo_texto?: string | null
          created_at?: string
          data_ingestao?: string
          documento_sei_id?: string | null
          id?: string
          metadados_json?: Json
          notebook_id: string
          orgao_id: string
          tipo_origem: string
          titulo: string
          url?: string | null
        }
        Update: {
          anonimizada?: boolean
          ativa?: boolean
          caminho_arquivo?: string | null
          checksum?: string | null
          conteudo_texto?: string | null
          created_at?: string
          data_ingestao?: string
          documento_sei_id?: string | null
          id?: string
          metadados_json?: Json
          notebook_id?: string
          orgao_id?: string
          tipo_origem?: string
          titulo?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fonte_documento_sei_id_fkey"
            columns: ["documento_sei_id"]
            isOneToOne: false
            referencedRelation: "documento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fonte_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebook"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fonte_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
        ]
      }
      fonte_tag: {
        Row: {
          fonte_id: string
          tag_id: string
        }
        Insert: {
          fonte_id: string
          tag_id: string
        }
        Update: {
          fonte_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fonte_tag_fonte_id_fkey"
            columns: ["fonte_id"]
            isOneToOne: false
            referencedRelation: "fonte"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fonte_tag_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tag"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagem: {
        Row: {
          chunks_citados: Json
          conteudo: string
          conversa_id: string
          data_criacao: string
          id: string
          indicador_confianca: Json
          orgao_id: string
          role: string
        }
        Insert: {
          chunks_citados?: Json
          conteudo: string
          conversa_id: string
          data_criacao?: string
          id?: string
          indicador_confianca?: Json
          orgao_id: string
          role: string
        }
        Update: {
          chunks_citados?: Json
          conteudo?: string
          conversa_id?: string
          data_criacao?: string
          id?: string
          indicador_confianca?: Json
          orgao_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagem_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagem_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoramento: {
        Row: {
          ativo: boolean
          data_cadastro: string
          id: string
          intervalo_verificacao: string
          orgao_id: string
          processo_id: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          data_cadastro?: string
          id?: string
          intervalo_verificacao: string
          orgao_id: string
          processo_id: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          data_cadastro?: string
          id?: string
          intervalo_verificacao?: string
          orgao_id?: string
          processo_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoramento_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoramento_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processo"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          orgao_id: string
          updated_at: string
          usuario_criador_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          orgao_id: string
          updated_at?: string
          usuario_criador_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          orgao_id?: string
          updated_at?: string
          usuario_criador_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacao_preferencia: {
        Row: {
          created_at: string
          email_eventos: Json
          id: string
          orgao_id: string
          updated_at: string
          usuario_id: string
          webhook_eventos: Json
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          email_eventos?: Json
          id?: string
          orgao_id: string
          updated_at?: string
          usuario_id: string
          webhook_eventos?: Json
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          email_eventos?: Json
          id?: string
          orgao_id?: string
          updated_at?: string
          usuario_id?: string
          webhook_eventos?: Json
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacao_preferencia_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
        ]
      }
      org_limits: {
        Row: {
          max_fontes_notebook: number
          max_notebooks: number
          orgao_id: string
          updated_at: string
          updated_by_id: string | null
        }
        Insert: {
          max_fontes_notebook?: number
          max_notebooks?: number
          orgao_id: string
          updated_at?: string
          updated_by_id?: string | null
        }
        Update: {
          max_fontes_notebook?: number
          max_notebooks?: number
          orgao_id?: string
          updated_at?: string
          updated_by_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_limits_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: true
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
        ]
      }
      orgao: {
        Row: {
          created_at: string
          id: string
          municipio: string | null
          nome: string
          sigla: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          municipio?: string | null
          nome: string
          sigla: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          municipio?: string | null
          nome?: string
          sigla?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      perfil: {
        Row: {
          created_at: string
          nome_completo: string
          onboarding_concluido: boolean
          orgao_id: string
          role: string
          sigla_unidade: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          nome_completo: string
          onboarding_concluido?: boolean
          orgao_id: string
          role: string
          sigla_unidade?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          nome_completo?: string
          onboarding_concluido?: boolean
          orgao_id?: string
          role?: string
          sigla_unidade?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfil_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
        ]
      }
      politica_retensao: {
        Row: {
          acao: string
          ativo: boolean
          created_at: string
          criado_por_id: string
          id: string
          nome: string
          orgao_id: string
          regra: Json
          tipo_entidade: string
        }
        Insert: {
          acao: string
          ativo?: boolean
          created_at?: string
          criado_por_id: string
          id?: string
          nome: string
          orgao_id: string
          regra: Json
          tipo_entidade: string
        }
        Update: {
          acao?: string
          ativo?: boolean
          created_at?: string
          criado_por_id?: string
          id?: string
          nome?: string
          orgao_id?: string
          regra?: Json
          tipo_entidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "politica_retensao_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
        ]
      }
      processo: {
        Row: {
          classificacao: Json
          created_at: string
          data_geracao: string
          data_inclusao: string
          id: string
          interessados: Json
          nup: string
          orgao_id: string
          sigiloso: boolean
          status: string
          tipo_processo_codigo: string
          tipo_processo_desc: string
          unidade_atual: string
          unidade_geradora: string
          updated_at: string
        }
        Insert: {
          classificacao?: Json
          created_at?: string
          data_geracao: string
          data_inclusao: string
          id?: string
          interessados?: Json
          nup: string
          orgao_id: string
          sigiloso?: boolean
          status: string
          tipo_processo_codigo: string
          tipo_processo_desc: string
          unidade_atual: string
          unidade_geradora: string
          updated_at?: string
        }
        Update: {
          classificacao?: Json
          created_at?: string
          data_geracao?: string
          data_inclusao?: string
          id?: string
          interessados?: Json
          nup?: string
          orgao_id?: string
          sigiloso?: boolean
          status?: string
          tipo_processo_codigo?: string
          tipo_processo_desc?: string
          unidade_atual?: string
          unidade_geradora?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processo_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
        ]
      }
      prorrogacao_cp: {
        Row: {
          consulta_publica_id: string
          created_at: string
          data_encerramento_nova: string
          data_extracao: string
          documento_sei_id: string | null
          id: string
          orgao_id: string
        }
        Insert: {
          consulta_publica_id: string
          created_at?: string
          data_encerramento_nova: string
          data_extracao?: string
          documento_sei_id?: string | null
          id?: string
          orgao_id: string
        }
        Update: {
          consulta_publica_id?: string
          created_at?: string
          data_encerramento_nova?: string
          data_extracao?: string
          documento_sei_id?: string | null
          id?: string
          orgao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prorrogacao_cp_consulta_publica_id_fkey"
            columns: ["consulta_publica_id"]
            isOneToOne: false
            referencedRelation: "consulta_publica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prorrogacao_cp_documento_sei_id_fkey"
            columns: ["documento_sei_id"]
            isOneToOne: false
            referencedRelation: "documento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prorrogacao_cp_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
        ]
      }
      seed_job: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          erro_msg: string | null
          filtros_json: Json
          id: string
          nup_alvo: string | null
          registros_inseridos: number | null
          status: string
          tipo: string
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          erro_msg?: string | null
          filtros_json?: Json
          id?: string
          nup_alvo?: string | null
          registros_inseridos?: number | null
          status: string
          tipo: string
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          erro_msg?: string | null
          filtros_json?: Json
          id?: string
          nup_alvo?: string | null
          registros_inseridos?: number | null
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      snapshot_processo: {
        Row: {
          dados_json: Json
          data_snapshot: string
          id: string
          orgao_id: string
          processo_id: string
          versao: number
        }
        Insert: {
          dados_json: Json
          data_snapshot?: string
          id?: string
          orgao_id: string
          processo_id: string
          versao: number
        }
        Update: {
          dados_json?: Json
          data_snapshot?: string
          id?: string
          orgao_id?: string
          processo_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "snapshot_processo_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snapshot_processo_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processo"
            referencedColumns: ["id"]
          },
        ]
      }
      tag: {
        Row: {
          cor: string
          created_at: string
          id: string
          nome: string
          orgao_id: string
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: string
          nome: string
          orgao_id: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          orgao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgao"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_org_quota: {
        Args: { p_notebook_id?: string; p_orgao_id: string }
        Returns: Json
      }
      complete_user_onboarding: { Args: never; Returns: undefined }
      fonte_readable: { Args: { p_fonte_id: string }; Returns: boolean }
      generate_checksum: { Args: { p_bytea: string }; Returns: string }
      get_dashboard_stats: { Args: { p_orgao_id: string }; Returns: Json }
      get_org_limits: {
        Args: { p_orgao_id: string }
        Returns: {
          max_fontes_notebook: number
          max_notebooks: number
        }[]
      }
      has_notebook_share: { Args: { p_notebook_id: string }; Returns: boolean }
      jwt_orgao_id: { Args: never; Returns: string }
      jwt_role: { Args: never; Returns: string }
      list_processo_chunk_embeddings: {
        Args: { p_orgao_id: string }
        Returns: {
          embedding: string
          processo_id: string
        }[]
      }
      list_processos_dashboard: {
        Args: {
          p_cursor_id?: string
          p_cursor_updated_at?: string
          p_limit?: number
          p_offset?: number
          p_orgao_id: string
        }
        Returns: {
          data_geracao: string
          id: string
          nup: string
          status: string
          tipo_processo_codigo: string
          tipo_processo_desc: string
          total_count: number
          unidade_atual: string
          updated_at: string
        }[]
      }
      match_chunks_hybrid: {
        Args: {
          p_candidate_limit?: number
          p_data_fim?: string
          p_data_inicio?: string
          p_fonte_ids?: string[]
          p_interessado?: string
          p_notebook_id: string
          p_nup?: string
          p_query_embedding: string
          p_query_text: string
          p_rrf_k?: number
          p_tag_ids?: string[]
          p_tipo_documento?: string[]
          p_top_k?: number
          p_unidade?: string[]
        }
        Returns: {
          chunk_id: string
          conteudo: string
          fonte_id: string
          metadados_json: Json
          score_rrf: number
        }[]
      }
      match_processos_similar_content: {
        Args: {
          p_match_limit?: number
          p_orgao_id: string
          p_processo_ref_id: string
        }
        Returns: {
          processo_id: string
          similarity_score: number
        }[]
      }
      notebook_readable: { Args: { p_notebook_id: string }; Returns: boolean }
      notebook_writable: { Args: { p_notebook_id: string }; Returns: boolean }
      owns_notebook: { Args: { p_notebook_id: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

