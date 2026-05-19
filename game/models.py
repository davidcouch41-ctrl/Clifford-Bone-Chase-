from django.db import models


class GameUser(models.Model):
    username = models.CharField(max_length=24, unique=True)
    password_hash = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'users'
        managed = False


class LeaderboardEntry(models.Model):
    user = models.ForeignKey(
        GameUser,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='scores',
        db_column='user_id',
        db_constraint=False,
    )
    name = models.CharField(max_length=24)
    score = models.IntegerField()
    level = models.IntegerField()
    loot = models.IntegerField()
    outcome = models.CharField(max_length=12)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'leaderboard'
        managed = False
