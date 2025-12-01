import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory storage for goals (in production, use a database)
let goals: any[] = [];

export async function GET() {
  return NextResponse.json({ goals });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const newGoal = {
      ...body,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };

    goals.push(newGoal);

    return NextResponse.json(newGoal);
  } catch (error) {
    console.error('Error creating goal:', error);
    return NextResponse.json(
      { error: 'Failed to create goal' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Goal ID required' },
        { status: 400 }
      );
    }

    goals = goals.filter(g => g.id !== id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting goal:', error);
    return NextResponse.json(
      { error: 'Failed to delete goal' },
      { status: 500 }
    );
  }
}
