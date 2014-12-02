"""username to uid

Revision ID: 27a8d9bcbd1b
Revises: 4a11791d63b1
Create Date: 2014-12-02 23:20:46.700938

"""

# revision identifiers, used by Alembic.
revision = '27a8d9bcbd1b'
down_revision = '4a11791d63b1'

from alembic import op
import sqlalchemy as sa


def upgrade():
	# add new columns
	with op.batch_alter_table('track_history', schema=None) as batch_op:
		batch_op.add_column(sa.Column('userid', sa.Integer(), nullable=True))
	
	with op.batch_alter_table('track_person', schema=None) as batch_op:
		batch_op.add_column(sa.Column('userid', sa.Integer(), nullable=True))
	
	with op.batch_alter_table('object', schema=None) as batch_op:
		batch_op.add_column(sa.Column('ownerid', sa.Integer(), nullable=True))
	
	with op.batch_alter_table('api_key', schema=None) as batch_op:
		batch_op.add_column(sa.Column('userid', sa.Integer(), nullable=True))
	
	with op.batch_alter_table('follower', schema=None) as batch_op:
		batch_op.add_column(sa.Column('follower_id', sa.Integer(), nullable=True))
		batch_op.add_column(sa.Column('following_id', sa.Integer(), nullable=True))
	
	# set userid column from username
	conn = op.get_bind()
	conn.execute("update track_history set userid = (select id from users where track_history.username = users.username)")
	conn.execute("update track_person set userid = (select id from users where track_person.username = users.username)")
	conn.execute("update object set ownerid = (select id from users where object.owner = users.username)")
	conn.execute("update api_key set userid = (select id from users where api_key.user = users.username)")
	conn.execute("update follower set follower_id = (select id from users where follower.follower = users.username)")
	conn.execute("update follower set following_id = (select id from users where follower.following = users.username)")
	
	# delete old columns
	with op.batch_alter_table('track_history', schema=None) as batch_op:
	    batch_op.drop_column('username')
	
	with op.batch_alter_table('track_person', schema=None) as batch_op:
	    batch_op.drop_column('username')
    
	with op.batch_alter_table('object', schema=None) as batch_op:
		batch_op.drop_column('owner')
	
	with op.batch_alter_table('api_key', schema=None) as batch_op:
		batch_op.drop_column('user')
    
	with op.batch_alter_table('follower', schema=None) as batch_op:
		batch_op.drop_column('follower')
		batch_op.drop_column('following')
		batch_op.alter_column('follower_id', new_column_name='follower')
		batch_op.alter_column('following_id', new_column_name='following')
    
    # not used atm but will be dealt with later
	with op.batch_alter_table('group', schema=None) as batch_op:
		batch_op.drop_column('owner')