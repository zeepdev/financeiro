import { createClient } from '@/lib/supabase/client';

export interface AttachmentItem {
  id: string;
  transaction_id?: string | null;
  profile_id?: string | null;
  nome_arquivo: string;
  storage_path: string;
  mime_type?: string | null;
  tamanho_bytes?: number | null;
  public_url?: string | null;
  extracted_data?: any;
  status?: 'pendente' | 'conciliado';
  tags?: string[];
  created_at: string;
  transaction?: {
    id: string;
    descricao: string;
    valor_centavos: number;
    tipo: string;
    data_competencia: string;
  } | null;
}

export async function uploadComprovanteFile(
  file: File,
  profileId: string,
  extractedData?: any
): Promise<{ success: boolean; attachment?: AttachmentItem; error?: string }> {
  try {
    const supabase = createClient();

    // Sanitiza nome do arquivo e gera path único
    const ext = file.name.split('.').pop() || 'bin';
    const timestamp = Date.now();
    const cleanName = file.name.replace(/[^a-zA-Z0-9\._-]/g, '_');
    const storagePath = `prints/${profileId}/${timestamp}_${cleanName}`;

    // 1. Upload para o bucket 'comprovantes' no Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('comprovantes')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.warn('Storage upload warning:', uploadError);
      // Caso o bucket retorne erro de RLS, continua com URL gerada
    }

    // 2. Obtém URL pública do arquivo
    const { data: urlData } = supabase.storage
      .from('comprovantes')
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl || '';

    // 3. Salva no banco de dados (tabela attachments)
    const { data: inserted, error: insertError } = await supabase
      .from('attachments')
      .insert({
        profile_id: profileId,
        nome_arquivo: file.name,
        storage_path: storagePath,
        mime_type: file.type || 'application/octet-stream',
        tamanho_bytes: file.size,
        public_url: publicUrl,
        extracted_data: extractedData || null,
        status: 'pendente',
      })
      .select('*')
      .single();

    if (insertError) {
      throw insertError;
    }

    return {
      success: true,
      attachment: inserted as AttachmentItem,
    };
  } catch (err: any) {
    console.error('Erro ao enviar comprovante:', err);
    return {
      success: false,
      error: err.message || 'Falha ao salvar comprovante no armazenamento.',
    };
  }
}

export async function listComprovantes(
  profileId: string,
  filter?: 'todos' | 'pendentes' | 'conciliados'
): Promise<AttachmentItem[]> {
  try {
    const supabase = createClient();

    let query = supabase
      .from('attachments')
      .select('*, transaction:transactions(id, descricao, valor_centavos, tipo, data_competencia)')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (filter === 'pendentes') {
      query = query.is('transaction_id', null);
    } else if (filter === 'conciliados') {
      query = query.not('transaction_id', 'is', null);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []) as AttachmentItem[];
  } catch (err) {
    console.error('Erro ao listar comprovantes:', err);
    return [];
  }
}

export async function linkComprovanteToTransaction(
  attachmentId: string,
  transactionId: string
): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('attachments')
      .update({
        transaction_id: transactionId,
        status: 'conciliado',
      })
      .eq('id', attachmentId);

    return !error;
  } catch {
    return false;
  }
}

export async function deleteComprovante(attachment: AttachmentItem): Promise<boolean> {
  try {
    const supabase = createClient();

    // 1. Remove do Storage
    if (attachment.storage_path) {
      await supabase.storage.from('comprovantes').remove([attachment.storage_path]);
    }

    // 2. Remove do Banco
    const { error } = await supabase.from('attachments').delete().eq('id', attachment.id);
    return !error;
  } catch {
    return false;
  }
}
