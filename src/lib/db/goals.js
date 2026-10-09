import { supabase } from '../supabase.js'

export async function listGoals(familyId, { incluirArquivadas = false } = {}) {
  let q = supabase
    .from('goals')
    .select(`
      *,
      contribuicoes:goal_contributions ( amount )
    `)
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })

  if (!incluirArquivadas) q = q.eq('is_archived', false)

  const { data, error } = await q
  if (error) throw error

  return data.map((g) => ({
    ...g,
    atual: (g.contribuicoes ?? []).reduce((s, c) => s + Number(c.amount), 0)
  }))
}

export async function createGoal(familyId, { name, target_amount, deadline, icon, color }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('goals')
    .insert({
      family_id: familyId,
      name,
      target_amount: Number(target_amount),
      deadline: deadline || null,
      icon: icon || '🎯',
      color: color || '#38bdf8',
      created_by: user.id
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateGoal(id, patch) {
  const { data, error } = await supabase
    .from('goals')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteGoal(id) {
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) throw error
}

export async function addContribution(goalId, { amount, date, notes, memberId }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('goal_contributions')
    .insert({
      goal_id: goalId,
      amount: Number(amount),
      date: date || new Date().toISOString().slice(0, 10),
      notes: notes || null,
      member_id: memberId || null,
      created_by: user.id
    })
    .select()
    .single()
  if (error) throw error
  return data
}