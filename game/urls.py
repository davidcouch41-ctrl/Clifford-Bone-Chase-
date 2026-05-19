from django.urls import path

from . import views


urlpatterns = [
    path('', views.home, name='home'),
    path('api/leaderboard', views.leaderboard_api, name='leaderboard'),
    path('api/me', views.me, name='me'),
    path('api/register', views.register, name='register'),
    path('api/login', views.login, name='login'),
    path('api/logout', views.logout, name='logout'),
    path('<str:asset_name>', views.asset, name='asset'),
]
