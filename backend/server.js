require('dotenv').config();

const Fastify = require('fastify');
const cors = require('@fastify/cors');
const jwt = require('@fastify/jwt');
const staticPlugin = require('@fastify/static');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const path = require('path');

const fastify = Fastify({ logger: true });

fastify.register(cors, { origin: true, credentials: true });
fastify.register(jwt, { secret: process.env.JWT_SECRET || 'default_secret_change_me' });

fastify.register(staticPlugin, {
  root: path.join(__dirname, '..', 'front'),
  prefix: '/'
});

// Используем переменные с префиксом NEXT_PUBLIC_
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Ошибка: Отсутствуют переменные окружения Supabase');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

fastify.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Неавторизован' });
  }
});

const hashPassword = (password) => bcrypt.hash(password, 10);
const comparePassword = (password, hash) => bcrypt.compare(password, hash);

const registerSchema = {
  body: {
    type: 'object',
    required: ['user_name', 'user_password'],
    properties: {
      user_name: { type: 'string', minLength: 3 },
      user_password: { type: 'string', minLength: 6 }
    }
  }
};

const loginSchema = {
  body: {
    type: 'object',
    required: ['user_name', 'user_password'],
    properties: {
      user_name: { type: 'string' },
      user_password: { type: 'string' }
    }
  }
};

const taskSchema = {
  body: {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', minLength: 1 },
      completed: { type: 'boolean', default: false }
    }
  }
};

fastify.post('/register', { schema: registerSchema }, async (request, reply) => {
  const { user_name, user_password } = request.body;

  const { data: existingUser, error: findError } = await supabase
    .from('User')
    .select('id')
    .eq('user_name', user_name)
    .maybeSingle();

  if (findError) {
    console.log('FIND ERROR:', findError);
    return reply.status(500).send({ error: 'Ошибка базы данных' });
  }
  if (existingUser) {
    return reply.status(400).send({ error: 'Пользователь уже существует' });
  }

  const hashedPassword = await hashPassword(user_password);
  const { data: newUser, error: insertError } = await supabase
    .from('User')
    .insert([{ user_name, user_password: hashedPassword }])
    .select('id, user_name, createdAt')
    .single();

  if (insertError) {
    console.log('INSERT ERROR:', insertError);
    return reply.status(500).send({ error: 'Не удалось создать пользователя' });
  }

  reply.status(201).send({ message: 'Регистрация успешна', user: newUser });
});

fastify.post('/login', { schema: loginSchema }, async (request, reply) => {
  const { user_name, user_password } = request.body;

  const { data: user, error: findError } = await supabase
    .from('User')
    .select('*')
    .eq('user_name', user_name)
    .single();

  if (findError || !user) {
    return reply.status(401).send({ error: 'Неверное имя или пароль' });
  }

  const validPassword = await comparePassword(user_password, user.user_password);
  if (!validPassword) {
    return reply.status(401).send({ error: 'Неверное имя или пароль' });
  }

  const token = fastify.jwt.sign(
    { userId: user.id, userName: user.user_name },
    { expiresIn: '7d' }
  );

  reply.send({ token, user: { id: user.id, user_name: user.user_name } });
});

fastify.register(async (protectedRoutes) => {
  protectedRoutes.addHook('onRequest', fastify.authenticate);

  protectedRoutes.get('/items', async (request, reply) => {
    const userId = request.user.userId;
    const { data: tasks, error } = await supabase
      .from('Items')
      .select('*')
      .eq('user_id', userId)
      .order('createdAt', { ascending: false });

    if (error) {
      return reply.status(500).send({ error: 'Ошибка получения задач' });
    }
    reply.send(tasks);
  });
  
  protectedRoutes.post('/items', { schema: taskSchema }, async (request, reply) => {
    const { title, completed = false } = request.body;
    const userId = request.user.userId;

    const { data: newTask, error } = await supabase
      .from('Items')
      .insert([{ title, completed, user_id: userId }])
      .select()
      .single();

    if (error) {
      return reply.status(500).send({ error: 'Не удалось создать задачу' });
    }
    reply.status(201).send(newTask);
  });

  protectedRoutes.put('/items/:id', async (request, reply) => {
    const { id } = request.params;
    const { title, completed } = request.body;
    const userId = request.user.userId;

    const { data: existingTask, error: findError } = await supabase
      .from('Items')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (findError || !existingTask) {
      return reply.status(404).send({ error: 'Задача не найдена или доступ запрещён' });
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (completed !== undefined) updates.completed = completed;

    const { data: updatedTask, error: updateError } = await supabase
      .from('Items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return reply.status(500).send({ error: 'Ошибка обновления задачи' });
    }
    reply.send(updatedTask);
  });

  protectedRoutes.delete('/items/:id', async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.userId;

    const { data: task, error: findError } = await supabase
      .from('Items')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (findError || !task) {
      return reply.status(404).send({ error: 'Задача не найдена или доступ запрещён' });
    }

    const { error: deleteError } = await supabase
      .from('Items')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return reply.status(500).send({ error: 'Ошибка удаления задачи' });
    }
    reply.send({ message: 'Задача удалена' });
  });
});

fastify.get('/', (request, reply) => {
  reply.sendFile('index.html');
});

const startServer = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port: port, host: '0.0.0.0' });
    console.log('Сервер запущен: http://localhost:' + port);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

startServer();