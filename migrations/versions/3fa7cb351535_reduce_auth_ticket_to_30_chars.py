"""reduce auth_ticket to 30 chars

Revision ID: 3fa7cb351535
Revises: 26c2e3b63643
Create Date: 2016-04-11 23:34:19.194139

"""

# revision identifiers, used by Alembic.
revision = '3fa7cb351535'
down_revision = '26c2e3b63643'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.drop_table('auth_ticket')

    op.create_table('auth_ticket',
    sa.Column('key', sa.String(length=30), nullable=False),
    sa.Column('userid', sa.Integer(), nullable=True),
    sa.Column('created', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['userid'], ['users.id'], ),
    sa.PrimaryKeyConstraint('key')
    )

