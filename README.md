# 🌱 Plantify

A full-stack habit and goal tracking application that transforms personal growth into a virtual gardening experience.

Users build habits, maintain streaks, and watch their virtual plants grow as they consistently complete goals. Plantify combines productivity tracking with visual progress mechanics to make habit formation more engaging and rewarding.

## Features

* Secure authentication with Clerk
* Personalized user dashboards
* Habit and goal management
* Daily progress tracking
* Streak tracking system
* Virtual plant growth visualization
* Persistent cloud-based data storage
* Responsive design for desktop and mobile

## Tech Stack

### Frontend

* Next.js
* TypeScript
* Tailwind CSS

### Backend & Services

* Supabase
* Clerk Authentication

## How It Works

1. Create an account or sign in.
2. Add habits and personal goals.
3. Mark tasks as completed each day.
4. Build streaks through consistency.
5. Watch your virtual plant grow as progress accumulates.

## Key Learning Outcomes

This project helped me gain practical experience with:

* Full-stack application architecture
* Authentication and user management
* Database design and integration
* TypeScript development
* State management in React applications
* Building engaging user experiences through gamification

## Future Improvements

* Achievement badges and rewards
* Habit analytics and insights
* Social accountability features
* Custom plant themes and growth paths
* Reminder notifications

## Installation

Clone the repository:

```bash
git clone https://github.com/madhurimayakkala/plantify.git
```

Install dependencies:

```bash
npm install
```

Create a `.env.local` file and add the required environment variables:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Deployment

Deployed using Vercel.

## Author

Madhurima Yakkala

* GitHub: github.com/madhurimayakkala
* LinkedIn: linkedin.com/in/madhurima-yakkala
