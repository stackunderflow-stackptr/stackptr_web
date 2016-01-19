"""add foreign keys for fields

Revision ID: 572a637f3d4c
Revises: 1c42fab426e8
Create Date: 2015-12-02 21:38:38.104006

"""

# revision identifiers, used by Alembic.
revision = '572a637f3d4c'
down_revision = '1c42fab426e8'

from alembic import op
import sqlalchemy as sa


def upgrade():
    ### commands auto generated by Alembic - please adjust! ###
    op.create_foreign_key(None, 'api_key', 'users', ['userid'], ['id'])
    op.create_foreign_key(None, 'object', 'users', ['ownerid'], ['id'])
    op.create_foreign_key(None, 'track_history', 'users', ['userid'], ['id'])
    op.create_foreign_key(None, 'track_person', 'users', ['userid'], ['id'])
    ### end Alembic commands ###


def downgrade():
    ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(None, 'track_person', type_='foreignkey')
    op.drop_constraint(None, 'track_history', type_='foreignkey')
    op.drop_constraint(None, 'object', type_='foreignkey')
    op.drop_constraint(None, 'api_key', type_='foreignkey')
    ### end Alembic commands ###