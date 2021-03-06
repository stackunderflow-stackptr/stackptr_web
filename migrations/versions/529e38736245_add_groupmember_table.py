"""add GroupMember table

Revision ID: 529e38736245
Revises: 27a8d9bcbd1b
Create Date: 2014-12-03 14:34:56.909429

"""

# revision identifiers, used by Alembic.
revision = '529e38736245'
down_revision = '27a8d9bcbd1b'

from alembic import op
import sqlalchemy as sa


def upgrade():
    ### commands auto generated by Alembic - please adjust! ###
    op.create_table('group_member',
    sa.Column('groupid', sa.Integer(), nullable=False),
    sa.Column('userid', sa.Integer(), nullable=False),
    sa.Column('role', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['groupid'], ['group.id'], ),
    sa.ForeignKeyConstraint(['userid'], ['users.id'], ),
    sa.PrimaryKeyConstraint('groupid', 'userid')
    )
    ### end Alembic commands ###


def downgrade():
    ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('group_member')
    ### end Alembic commands ###
