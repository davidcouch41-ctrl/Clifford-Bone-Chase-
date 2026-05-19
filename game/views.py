import json
from pathlib import Path

from django.http import FileResponse, Http404, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from werkzeug.security import check_password_hash, generate_password_hash

from .models import GameUser, LeaderboardEntry


ROOT = Path(__file__).resolve().parent.parent
PUBLIC_ASSETS = {
    'script.js',
    'style.css',
}


def get_current_user(request):
    user_id = request.session.get('user_id')
    if not user_id:
        return None
    return GameUser.objects.filter(id=user_id).first()


def parse_json_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode('utf-8'))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


@require_GET
def home(request):
    return FileResponse((ROOT / 'index.html').open('rb'))


@require_GET
def asset(request, asset_name):
    if asset_name not in PUBLIC_ASSETS:
        raise Http404()
    return FileResponse((ROOT / asset_name).open('rb'))


def serialize_leaderboard():
    entries = LeaderboardEntry.objects.select_related('user').order_by(
        '-score',
        '-level',
        '-loot',
        'created_at',
    )[:10]
    return [
        {
            'name': entry.name,
            'score': entry.score,
            'level': entry.level,
            'loot': entry.loot,
            'outcome': entry.outcome,
            'created_at': entry.created_at.isoformat() if entry.created_at else None,
            'username': entry.user.username if entry.user else None,
        }
        for entry in entries
    ]


def leaderboard(request):
    if request.method == 'GET':
        return JsonResponse(serialize_leaderboard(), safe=False)

    if request.method == 'POST':
        payload = parse_json_body(request)
        user = get_current_user(request)
        name = (user.username if user else str(payload.get('name', '')).strip())[:24]
        if not name:
            return JsonResponse({'error': 'Name is required.'}, status=400)

        entry = LeaderboardEntry(
            user=user,
            name=name,
            score=max(int(payload.get('score', 0) or 0), 0),
            level=max(int(payload.get('level', 0) or 0), 0),
            loot=max(int(payload.get('loot', 0) or 0), 0),
            outcome=(str(payload.get('outcome', 'busted')).strip()[:12] or 'busted'),
        )
        entry.save(force_insert=True)
        return JsonResponse({'ok': True}, status=201)

    return JsonResponse({'error': 'Method not allowed.'}, status=405)


@csrf_exempt
def leaderboard_api(request):
    return leaderboard(request)


@require_GET
def me(request):
    user = get_current_user(request)
    if not user:
        return JsonResponse({'user': None})
    return JsonResponse({'user': {'id': user.id, 'username': user.username}})


@csrf_exempt
@require_POST
def register(request):
    payload = parse_json_body(request)
    username = str(payload.get('username', '')).strip()[:24]
    password = str(payload.get('password', ''))

    if len(username) < 3:
        return JsonResponse({'error': 'Username must be at least 3 characters.'}, status=400)
    if len(password) < 6:
        return JsonResponse({'error': 'Password must be at least 6 characters.'}, status=400)
    if GameUser.objects.filter(username__iexact=username).exists():
        return JsonResponse({'error': 'Username already exists.'}, status=400)

    user = GameUser(username=username, password_hash=generate_password_hash(password))
    user.save(force_insert=True)
    request.session['user_id'] = user.id
    return JsonResponse({'ok': True, 'user': {'id': user.id, 'username': user.username}}, status=201)


@csrf_exempt
@require_POST
def login(request):
    payload = parse_json_body(request)
    username = str(payload.get('username', '')).strip()
    password = str(payload.get('password', ''))
    user = GameUser.objects.filter(username__iexact=username).first()
    if not user or not check_password_hash(user.password_hash, password):
        return JsonResponse({'error': 'Invalid username or password.'}, status=400)

    request.session['user_id'] = user.id
    return JsonResponse({'ok': True, 'user': {'id': user.id, 'username': user.username}})


@csrf_exempt
@require_POST
def logout(request):
    request.session.pop('user_id', None)
    return JsonResponse({'ok': True})
