"""empty message

Revision ID: 26a99a9ae26b
Revises: 1b596e612179
Create Date: 2015-11-22 21:18:08.297270

"""

# revision identifiers, used by Alembic.
revision = '26a99a9ae26b'
down_revision = '1b596e612179'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.drop_constraint(u'group_name_key', 'group', type_='unique')


def downgrade():
    op.create_unique_constraint(u'group_name_key', 'group', ['name'])
