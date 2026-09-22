import { Typography } from '@/components/typography'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'

/**
 * What a visitor sees before they have an account. The four levels are the product, so they are
 * the first thing explained: someone who does not understand why a day is planned out of steps
 * will read the app as another to-do list and leave.
 *
 * This lives in the browser app rather than the public site, which this project deliberately
 * left switched off - see `website/README.md`. It is a page for people arriving with a link,
 * not a page competing for search results.
 */
export function LandingPage({ returnTo }: { returnTo?: string }) {
  const signupHref = returnTo
    ? `/signup?returnTo=${encodeURIComponent(returnTo)}`
    : '/signup'
  const loginHref = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 p-6 md:py-16" data-testid="landing">
      <header className="flex flex-col gap-4">
        <Typography as="h1" variant="h3">
          DiLife
        </Typography>
        <Typography tone="muted" variant="lead">
          План дня, который ведёт к цели. Большая цель делится на этапы, этапы — на шаги, шаги
          попадают в сегодняшний день. Каждый прожитый день видно.
        </Typography>
        <div className="flex flex-wrap gap-3">
          <Button asChild data-testid="landing-signup">
            <a href={signupHref}>
              <Typography variant="label">Начать</Typography>
            </a>
          </Button>
          <Button asChild data-testid="landing-login" variant="outline">
            <a href={loginHref}>
              <Typography variant="label">Войти</Typography>
            </a>
          </Button>
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <Typography as="h2" variant="h5">
          Четыре уровня
        </Typography>
        <ol className="flex flex-col gap-3">
          {levels.map((level, index) => (
            <li className="flex gap-3" key={level.title}>
              <Typography tone="muted" variant="h6">
                {String(index + 1)}
              </Typography>
              <div className="flex flex-col gap-1">
                <Typography variant="bodySmMedium">{level.title}</Typography>
                <Typography tone="muted" variant="bodySm">
                  {level.description}
                </Typography>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-4">
        <Typography as="h2" variant="h5">
          Что внутри
        </Typography>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <Typography as="h3" variant="h6">
                  {feature.title}
                </Typography>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <Card data-testid="landing-cta">
        <CardHeader>
          <Typography as="h2" variant="h6">
            Начните с дела вашей жизни
          </Typography>
          <CardDescription>
            Назовите то, ради чего ставите цели — остальное вырастет из него.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild data-testid="landing-cta-signup">
            <a href={signupHref}>
              <Typography variant="label">Создать аккаунт</Typography>
            </a>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}

const levels = [
  {
    title: 'Дело вашей жизни',
    description: 'То, ради чего всё остальное. Одно, без срока.',
  },
  {
    title: 'Цели',
    description: 'У каждой обязательный срок и своя мера: километры, страницы, занятия.',
  },
  {
    title: 'Этапы',
    description: 'Крупные части цели, чтобы путь был виден целиком.',
  },
  {
    title: 'Шаги',
    description: 'Самое мелкое действие. Шаг ставится в день — так цель и движется.',
  },
]

const features = [
  {
    title: 'День',
    description:
      'Задачи со временем, подзадачи, шаблоны дня. Невыполненное переносится или отпускается — решаете вы.',
  },
  {
    title: 'Привычки',
    description:
      'Гибкое расписание и полоса выполнения. Серия считается только по дням, когда привычка ожидалась.',
  },
  {
    title: 'Горизонт жизни',
    description: 'Сетка недель и оставшееся время — чтобы помнить, на что оно уходит.',
  },
  {
    title: 'Статистика',
    description: 'Неделя, месяц, год: что сделано, куда ушло время, как держатся привычки.',
  },
]
