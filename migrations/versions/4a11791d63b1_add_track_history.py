"""add track_history

Revision ID: 4a11791d63b1
Revises: 2709792fc2f9
Create Date: 2014-09-27 14:29:01.391648

"""

# revision identifiers, used by Alembic.
revision = '4a11791d63b1'
down_revision = '2709792fc2f9'

from alembic import op
import sqlalchemy as sa


def upgrade():
    ### commands auto generated by Alembic - please adjust! ###
    op.create_table('track_history',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('username', sa.String(length=80), nullable=True),
    sa.Column('lat', sa.Float(), nullable=True),
    sa.Column('lon', sa.Float(), nullable=True),
    sa.Column('extra', sa.String(length=512), nullable=True),
    sa.Column('time', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['username'], ['users.username'], ),
    sa.PrimaryKeyConstraint('id')
    )
    ### end Alembic commands ###


def downgrade():
    ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('track_history')
    ### end Alembic commands ###