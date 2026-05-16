
module.exports = async function requestRoutes(fastify, options) {

  fastify.get("/my-requests", { preHandler: fastify.authenticate }, async (req, res) => {
    const requests = await fastify.prisma.application.findMany({
      where: { userId: req.user.id }
    });
    return res.view("my_requests.ejs", { requests });
  });

  // HTMX: Оставление отзыва юзером
  fastify.post("/request/:id/review", { preHandler: fastify.authenticate }, async (req, res) => {
    const { id } = req.params;
    const { review } = req.body;

    await fastify.prisma.application.update({
      where: { id: id },
      data: { review }
    });

    return `<span class="text-muted text-break">Вы оставили отзыв: ${review}</span>`;
  });

  // 2. Страница создания новой заявки
  fastify.get("/create-request", { preHandler: fastify.authenticate }, async (req, res) => {
    return res.view("create_request.ejs");
  });

  // HTMX: Обработка отправки формы создания заявки
  fastify.post("/create-request", { preHandler: fastify.authenticate }, async (req, res) => {
    const { courseName, startDate, payMethod } = req.body;

    await fastify.prisma.application.create({
      data: {
        courseName,
        startDate: new Date(startDate),
        // Переводим русскую строку из формы в ENUM вашей БД
        paymentType: payMethod === 'наличными' ? 'CASH' : 'PHONE',
        userId: req.user.id
      }
    });

    // Редирект средствами HTMX на список заявок
    res.header("HX-Redirect", "/requests/my-requests");
    return "";
  });

  // 3. Панель администратора
  fastify.get("/admin", { preHandler: fastify.authenticate }, async (req, res) => {
    // Проверка жестких условий из задания (Доступ по логину Admin)
    // Так как при авторизации мы зашили данные в JWT, проверим роль
    if (req.user.role !== 'ADMIN') {
      return res.status(403).send("Доступ запрещен. Эта панель только для Администратора.");
    }

    const allRequests = await fastify.prisma.application.findMany();
    return res.view("admin_panel.ejs", { requests: allRequests });
  });

  // HTMX: Быстрое обновление статуса в админке
  fastify.post("/admin/request/:id/status", { preHandler: fastify.authenticate }, async (req, res) => {
    if (req.user.role !== 'ADMIN') return "Ошибка прав";

    const { id } = req.params;
    const { status } = req.body; // Ожидаем 'TRAINING' или 'COMPLETED'

    const updated = await fastify.prisma.application.update({
      where: { id: id },
      data: { status: status }
    });

    // Возвращаем обновленный HTML-кусок для ячейки таблицы
    const statusText = updated.status === 'NEW' ? 'Новая' : updated.status === 'TRAINING' ? 'Идет обучение' : 'Обучение завершено';
    const badgeColor = updated.status === 'NEW' ? 'bg-primary' : updated.status === 'TRAINING' ? 'bg-warning text-dark' : 'bg-success';

    return `
      <span class="badge ${badgeColor} mb-2 d-inline-block">${statusText}</span>
      <div class="btn-group btn-group-sm d-block">
        <button class="btn btn-outline-warning" hx-post="/requests/admin/request/${updated.id}/status" hx-vals='{"status": "TRAINING"}' hx-target="closest td">Обучение</button>
        <button class="btn btn-outline-success" hx-post="/requests/admin/request/${updated.id}/status" hx-vals='{"status": "COMPLETED"}' hx-target="closest td">Завершить</button>
      </div>
    `;
  });
};